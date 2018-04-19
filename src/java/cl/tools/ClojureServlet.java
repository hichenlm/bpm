package cl.tools;

import clojure.lang.RT;
import clojure.lang.Var;
import com.google.common.base.Throwables;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class ClojureServlet extends HttpServlet {

    private String ns;
    //private Var var_service;

    public void init() throws ServletException {
        ns = getInitParameter("ns");
        try {
            log("load ns " + ns);
            RT.load(ns.replace('.', '/'));
            Var init = RT.var(ns, "init");
            if (init.isBound()) {
                init.invoke(this);
            }
        } catch (Exception e) {
            throw Throwables.propagate(e);
        }
    }

    public void destroy() {
        Var destroy = RT.var(ns, "destroy");
        if (destroy.isBound()) {
            destroy.invoke(this);
        }
    }

    public void service(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            log("load ns " + ns);
            RT.load(ns.replace('.', '/'));
        } catch (Exception e) {
            throw Throwables.propagate(e);
        }
        
        Var var_service = RT.var(ns, "service");
        if (var_service.isBound()) {
            var_service.invoke(this, req, resp);
        }
    }
}
