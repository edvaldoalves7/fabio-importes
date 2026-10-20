package com.fabioimportes;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Porteiro das rotas /api: so deixa passar quem tem um "cracha" (token) valido.
 * O login (/api/login) fica de fora, pois e por onde o cracha e emitido.
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final Seguranca seguranca;

    public AuthInterceptor(Seguranca seguranca) {
        this.seguranca = seguranca;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String header = request.getHeader("Authorization");
        String token = (header != null && header.startsWith("Bearer ")) ? header.substring(7) : "";
        if (seguranca.validarToken(token)) {
            return true;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"erro\":\"Nao autorizado. Faca login novamente.\"}");
        return false;
    }
}
