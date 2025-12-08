package application.rest;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;

@Provider
public class RequestHeaderLoggingFilter implements ContainerRequestFilter {
    public RequestHeaderLoggingFilter() {
        // Public constructor required for JAX-RS provider
    }
    
    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        System.out.println("Incoming request: " + requestContext.getMethod() + " " + requestContext.getUriInfo().getPath());
        System.out.println("Incoming request headers:");
        // Log all headers exactly as received by the server
        for (String headerName : requestContext.getHeaders().keySet()) {
            System.out.println("  " + headerName + ": " + requestContext.getHeaderString(headerName));
        }
    }
}

