(defn is-quote-char [c] (or (= \' c) (= \" c)))

(defn split-expression [s]
  (let [initial-state {:codes [] :chars [] :escape false :quote nil}
        final-state (reduce 
                     (fn [state c] 
                       (let [{:keys [chars quote escape codes]} state
                             state (assoc state :chars (conj chars c))]
                         (cond escape (assoc state :escape false)
                               quote (cond (= c quote) (assoc state :codes (conj codes (:chars state)) :quote nil :chars [])
                                           (= c \\) (assoc state :escape true)
                                           :else state)
                               (is-quote-char c) (if (empty? chars)
                                                   (assoc state :quote c)
                                                   (assoc state :codes (conj codes chars) :quote c :chars [c]))
                               :else state)))                     
                     initial-state (seq s))]
    (let [{:keys [chars codes]} final-state]
      (if (empty? chars) codes (conj codes chars)))))

(defn compile-complex-cond [s]
  (let [m (re-matcher #"<(\S+)>"  s)
        buf (StringBuffer.)]
    (while (.find m)
      (.appendReplacement m buf (str "__data__[\"" (.group m 1) "\"]")))
    (.appendTail m buf)
    (.toString buf)))

(compile-complex-cond "return <直属上级审批结果> == \"同意\"")

