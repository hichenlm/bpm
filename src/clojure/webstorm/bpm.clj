(ns webstorm.bpm
 (:use [clojure.tools.logging])
 (:require [clojure.java.jdbc :as jdbc]
           [clojure.data.json :as json]))

(def ^{:dynamic true} *executor*)
(def ^{:dynamic true} *service-runner*)
(def ^{:dynamic true} *db*)
(def ^{:dynamic true} *participant-rule-runner*)
(def ^{:dynamic true} *participant-collector*)

(def DB-SPEC {:name "java:comp/env/ds/wsbpm"})

(defn init [this]
  (info "servlet initializing ...")
  (info "servlet initialized"))

(defn destroy [this]
  (info "servlet destroyed"))

(defn save-bp-def [input-stream]
  (let [s (slurp (java.io.InputStreamReader. input-stream "utf-8"))
        data (json/read-str s)
        id (get data "id")]
    (jdbc/update! *db* :bp_def {:bp s} ["id = ?" id])))

(defn load-bp-str [from id]
  (let [sql (str "SELECT bp FROM BP_" from " WHERE id = ?")
        rs (jdbc/query *db* [sql id])]
    (:bp (first rs))))

(defn load-bp [from id]
  (json/read-str (load-bp-str from id)))

(defn load-task [task-id]
  (let [sql "SELECT * FROM BP_TASK WHERE ID = ?"
        rs (jdbc/query *db* [sql task-id])]
    (first rs)))

(defn service [this req resp]  
  (info "service " (.getMethod req) " " (.getPathInfo req) " " (.getQueryString req))
  (binding [*db* DB-SPEC]
    (let [action (.getPathInfo req)]
      (cond (= action "/save-bp-def")
            (save-bp-def (.getInputStream req))
            (.startsWith action "/load-bp")
            (let [from (.getParameter req "from")
                  id (.getParameter req "id")
                  s (load-bp-str from id)]
              (..  resp (getOutputStream) (write (.getBytes s "utf-8"))))))))

(defn next-seq-val [seq-name]
  (.toString (java.util.UUID/randomUUID)))

(defn start-event? [node]
  (and (= (get node "category") "event")
       (= (get node "type") "start")))

(defn end-event? [node]
  (and (= (get node "category") "event")
       (= (get node "type") "end")))

(defn human-task? [node]
  (and (= (get node "category") "task")
       (= (get node "type") "human")))

(defn service-task? [node]
  (and (= (get node "category") "task")
       (= (get node "type") "service")))

(defn exclusive-gateway? [node]
  (and (= (get node "category") "gateway")
       (= (get node "type") "exclusive")))

(defn current-time []
  (java.sql.Timestamp. (System/currentTimeMillis)))

(defn to-map-by-id [ls]
  (zipmap (map #(get % "id") ls) ls)) 

(defn to-map-by-name [ls] 
  (zipmap (map #(get % "name") ls) ls))

(defn nodes [bp] (get bp "nodes"))

(defn fields [bp] (get bp "fields"))

(defn get-node [bp id] 
  (get-in bp ["nodes" id]))

(defn get-connection [bp id]
  (get-in bp ["connections" id]))

(defn connections [bp] (get bp "connections"))

(defn update-state [obj state]
  (assoc obj "state" state))

(defn to-executed [obj]
  (assoc obj "state" "executed" "executor" *executor*))

(defn mapped-bp [bp]
  (assoc bp
    "connections" (to-map-by-id (get bp "connections"))
    "nodes" (to-map-by-id (get bp "nodes"))
    "fields" (to-map-by-name (get bp "fields"))))

(defn unmapped-bp [bp]
  (assoc bp
    "connections" (vals (connections bp))
    "nodes" (vals (nodes bp))
    "fields" (vals (fields bp))))

(defn update-node [bp node]
  (assoc bp "nodes" (assoc (nodes bp) (get node "id") node)))

(defn update-connection [bp conn]
  (assoc bp "connections" (assoc (connections bp) (get conn "id") conn)))

(defn update-data [bp data]
  (assoc bp "data" (merge (get bp "data") data)))

(defn get-param-value [data value-is-var value-spec]
  (if value-is-var
    (get data value-spec)
    value-spec))

(defn cond-weight [c]
  [(if (get c "is-default-connection") 1 0)
   (get c "priority")])

(def COND-OP-FN 
  {
   "大于" > 
   "大于等于" >=
   "等于" = 
   "小于等于" <= 
   "小于" <
   "是" =
   "不是" (complement =)
   })

(defn eval-simple-cond [c data]
  (let [conf (get c "config")
        variable (get conf "cond-variable")
        left (get data variable)
        op (get conf "cond-comparator")
        right (let [v (get-param-value data (get conf "value-is-var") (get conf "cond-value"))]
                (if (instance? java.lang.Number left)
                  (read-string v)
                  v))]
    (info "eval-simple-cond " [variable left op right])
    ((COND-OP-FN op) left right)))

(defn compile-complex-cond [s]
  (info "compile-complex-cond:" s)
  (let [m (re-matcher #"\{(\S+)\}"  s)
        buf (StringBuffer.)]
    (while (.find m)
      (.appendReplacement m buf (str "__data__.get(\"" (.group m 1) "\")")))
    (.appendTail m buf)
    (.toString buf)))

(defn eval-js-string [cx scope s]
  (. cx evaluateString scope s "js-expression" 1 nil))

(defn eval-js-condition [expr data]
  (info "eval-js-condition" expr data)
  (try 
    (let [cx (org.mozilla.javascript.Context/enter)
          scope (.initStandardObjects cx)]
      (eval-js-string cx scope (str "function __eval_condition__(__data__) {\n" expr "\n}"))
      (let [fn (.get scope "__eval_condition__")
            result (.call fn cx scope nil (into-array [data]))]
        (if (instance? org.mozilla.javascript.Wrapper result)
          (.unwrap result)
          result)))
    (finally
      (org.mozilla.javascript.Context/exit))))

(defn eval-complex-cond [c data]
  (let [s (compile-complex-cond (get-in c ["config" "cond-complex"]))]
    (info "compiled:" s)
    (eval-js-condition s data)))

(defn eval-cond [c data]
  (info "eval-cond " c)  
  (let [conf (get c "config")]
  (or (get conf "is-default-connection")
      (if (= (get conf "cond-type") "simple")
        (eval-simple-cond c data)
        (eval-complex-cond c data)))))

(defn next-node [bp connection]
  (get-node bp (get connection "toNode")))

(declare execute-exclusive-gateway execute-service-task)

(defn go-forward [bp connection]
  (info "go-forward " connection)
  (let [node (next-node bp connection)
        bp (update-connection bp (to-executed connection))]
    (info "go-forward " node)
    (cond 
     (end-event? node) (update-node bp (to-executed node))
     (human-task? node) (update-node bp (update-state node "running"))
     (exclusive-gateway? node) (execute-exclusive-gateway bp node)
     (service-task? node) (execute-service-task bp node)
     :esle bp)))

(defn execute-exclusive-gateway [bp gateway]  
  (let [conn (->> (get gateway "outConns")
                  (map #(get-connection bp %))
                  (sort #(- (compare (cond-weight %1) (cond-weight %2))))
                  (drop-while #(not (eval-cond % (get bp "data"))))
                  (first))]
    (-> bp
        (update-node (to-executed gateway))
        (go-forward conn))))

(defn execute-service-task [bp node]
  (let [conf (get node "config")
        service (get conf "service")
        data (get bp "data")
        output-data-list (get conf "output-data")        
        service-output-data (*service-runner* service data)
        new-data (into data (filter (partial find output-data-list) service-output-data))
        conn-id (first (get node "outConns"))
        conn (get-connection bp conn-id)]
    (info "execute-service-task " [service data service-output-data new-data])
    (-> bp 
        (update-node (to-executed node))
        (update-data new-data)
        (go-forward conn))))

(defn execute-human-task-internal [bp node data]
  (info "execute-human-task-internal, node is" node)
  (let [conn-id (first (get node "outConns"))
        conn (get-connection bp conn-id)]
    (info "execute-human-task-internal conn is " conn)
    (-> bp
        (update-node (to-executed node))
        (update-data data)
        (go-forward conn))))

(defn all-to-waiting [objs]
  (into {} (map (fn [[k obj]]
                  [k (update-state obj "waiting")])
                objs)))

(defn get-running-human-tasks [bp]
  (->> (vals (nodes bp))
       (filter #(= (get % "state") "running"))))

(defn single-participant [plist]
  (when (and (= (count plist) 1)
             (= "user" (get (first plist) "type")))
    (get (first plist) "id")))

(defn execute-rule [rule data]
  (let [rule-name (get rule "ruleName")
        params (get rule "params")        
        pnames (map #(get % "name") params)
        pvalues (map #(get-param-value data (get % "valueIsVar") (get % "value")) params)]
    (*participant-rule-runner* rule-name (zipmap pnames pvalues))))

(defn get-participant-list [bp node]
  (let [conf (get node "config")]    
    (case (get conf "set-participant-by")
      "bussiness-rule" (let [data (get bp "data")
                             p-list (get conf "participant-list")
                             rule-list (get conf "participant-rule-list")
                             p-list-list (into (if (seq p-list) [p-list] [])
                                               (map #(execute-rule % data) rule-list))]
                         (*participant-collector* p-list-list))
      "task-executor" (let [node-id (get conf "participant-task-executor")
                            node (get-node bp node-id)]
                        (get node "executor"))
      "relative-data" (let [d (get conf "participant-relative-data")
                            dt (get (fields bp) d)
                            t (get dt "type")
                            v (get-in bp ["data" d])
                            v (if (vector? v) v [v])
                            ls (map #(hash-map "type" t "id" %) v)]
                        (info "relative-data:" d ", ls:" ls)
                        (*participant-collector* [ls])))))

(defn generate-tasks [bp inst-id node]
  (let [node-id (get node "id")
        task-id (next-seq-val "bp_task")
        plist (get-participant-list bp node)
        single (single-participant plist)
        params {:id task-id
                :inst_id inst-id
                :node_id node-id
                :state (if single "fetched" "not-fetched")
                :owner single}]
    (jdbc/insert! *db* :bp_task params)
    (doseq [p plist]
      (jdbc/insert! *db* :bp_task_participant
                    {:task_id task-id :participant p}))))

(defn start-process [id data executor context]
  (binding [*service-runner* (:service-runner context)
            *participant-rule-runner* (:participant-rule-runner context)
            *participant-collector* (:participant-collector context)
            *executor* executor
            *db* (:db context)]
    (let [bp (mapped-bp (load-bp "def_online" id))
          start-node (first (filter start-event? (vals (nodes bp))))
          start-conn-id (first (get start-node "outConns"))
          start-conn (get-connection bp start-conn-id)
        
          first-human-task-node (let [node-id (get start-conn "toNode")]
                                  (get-node bp node-id))
          bp (-> (assoc bp "nodes" (all-to-waiting (nodes bp))
                        "connections" (all-to-waiting (connections bp)))
                 (update-node (to-executed start-node))
                 (update-connection (to-executed start-conn))
                 (execute-human-task-internal first-human-task-node data))
          bp-str (-> (unmapped-bp bp)
                     (json/write-str))
          inst-id (next-seq-val "bp_instance")]
      (doseq [node (get-running-human-tasks bp)]
        (generate-tasks bp inst-id node))
      (jdbc/insert! *db* :bp_instance {:id inst-id :def_id id :bp bp-str})
      (jdbc/insert! *db* :bp_step {:id (next-seq-val "bp_step") 
                                 :node_id (get first-human-task-node "id")
                                 :inst_id inst-id
                                 :executor executor
                                 :execution_time (current-time)})
      inst-id)))

(defn complete-task [task-id]
  (jdbc/update! *db* :bp_task {:state "done" :execution_time (current-time)} ["id = ?" task-id])
  (jdbc/delete! *db* :bp_task_participant ["task_id = ?" task-id]))

(defn execute-human-task [task-id data context]
  (binding [*service-runner* (:service-runner context)
            *participant-rule-runner* (:participant-rule-runner context)
            *participant-collector* (:participant-collector context)
            *db* (:db context)]    
    (let [task (load-task task-id)
          inst-id (:inst_id task)
          bp (mapped-bp (load-bp "instance" inst-id))
          node (get-node bp (:node_id task))
          owner (:owner task)]
      (binding [*executor* owner]
        (let [bp (execute-human-task-internal bp node data)
              bp-str (-> (unmapped-bp bp)
                         (json/write-str))]
          (doseq [node (get-running-human-tasks bp)]
            (generate-tasks bp inst-id node))
          (jdbc/update! *db* :bp_instance {:bp bp-str} ["id = ?" inst-id])
          (jdbc/insert! *db* :bp_step {:id (next-seq-val "bp_step") 
                                     :node_id (get node "id")
                                     :inst_id inst-id
                                     :executor *executor*
                                     :execution_time (current-time)})
          (complete-task task-id))))))
