(use 'clojure.tools.logging)
(require '(webstorm [bpm :as bpm]))
(require '[clojure.java.jdbc :as jdbc])
;; (require '(clojure.java (jdbc :as jdbc)))

(def db  
  {:classname "com.mysql.jdbc.Driver"
   :subprotocol "mysql"
   :subname "//localhost:3306/demo"
    :user "root"
    :password "123456"})

(defn get-max-task-id [db inst-id]
  (let [sql "select max(id) as id from bp_task where inst_id = ?"
        rs (jdbc/query db [sql inst-id])]
    (:id (first rs))))

(defn publish-bp [db id]  
  (jdbc/delete! db :bp_def_online ["id = ?" id])
  (jdbc/execute! db ["insert into bp_def_online (id, bp) select id, bp from bp_def where id = ?" id]))

(def process-def-id "leave_process")

(publish-bp db process-def-id)

(def apply-data {"申请人" "chenlm"
                 "申请人所属机构" "博雅软件"
                 "请假天数" 4})
(def executor "chenlm")

(defn service-runner [service-id data]
  {"hello" 123})

(defn participant-rule-runner [rule-name params]  
  (info "participant-rule-runner:" [rule-name params])
  [{"type" "user", "id" "rule"}])

(defn participant-collector [p-list-list]
  (info "participant-collector:" p-list-list)
  [(str "collector:" (get (first (apply concat p-list-list)) "id"))])

(def context {:service-runner service-runner
              :participant-rule-runner participant-rule-runner
              :participant-collector participant-collector
              :db db})

(def inst-id (bpm/start-process process-def-id apply-data executor context))

(info "start-process, inst_id is " inst-id)

(def approve-data {"直属上级审批结果" "同意"
                   "直属上级" "dongchangxing"})

(def task-id (get-max-task-id db inst-id))

(info "executing task " task-id)
(bpm/execute-human-task task-id approve-data context)

(def task-id (get-max-task-id db inst-id))
(def approve-data {"部门领导审批结果" "同意"})
(info "executing task " task-id)
(bpm/execute-human-task task-id approve-data context)


