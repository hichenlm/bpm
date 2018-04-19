export CLASSPATH=./lib/clojure-1.6.0.jar:./lib/tools.logging-0.2.6.jar:./lib/js.jar:./lib/guava-17.0.jar:./lib/servlet-api.jar:./lib/mysql-connector-java-5.1.46.jar:src/clojure
java -cp $CLASSPATH clojure.main $*
