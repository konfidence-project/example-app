package application.rest;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;

@Provider
public class RequestHeaderLoggingFilter implements ContainerRequestFilter, ContainerResponseFilter {
    private static final String VECTOR_ID_HEADER_PROP = "vector-id-header";
    
    public RequestHeaderLoggingFilter() {
        // Public constructor required for JAX-RS provider
    }
    
    private String getVectorIdHeader() {
        String envHeader = System.getenv("VECTOR_ID_HEADER");
        return envHeader != null ? envHeader : "x-vector-id";
    }
    
    private String getVectorId(ContainerRequestContext requestContext) {
        String vectorIdHeader = getVectorIdHeader();
        return requestContext.getHeaderString(vectorIdHeader);
    }
    
    private void logRequest(String direction, String method, String path, String vectorId, int statusCode) {
        String vectorIdStr = (vectorId != null && !vectorId.isEmpty()) ? "vector-id=" + vectorId : "vector-id=";
        System.out.println("[reviews] " + direction + " " + method + " " + path + " " + vectorIdStr + " status=" + statusCode);
    }
    
    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String vectorId = getVectorId(requestContext);
        requestContext.setProperty(VECTOR_ID_HEADER_PROP, vectorId);
    }
    
    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) throws IOException {
        String vectorId = (String) requestContext.getProperty(VECTOR_ID_HEADER_PROP);
        if (vectorId == null) {
            vectorId = getVectorId(requestContext);
        }
        String method = requestContext.getMethod();
        String path = requestContext.getUriInfo().getPath();
        int statusCode = responseContext.getStatus();
        logRequest("IN", method, path, vectorId, statusCode);
    }
}

