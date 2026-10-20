package com.fabioimportes;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cuida de senha (hash) e do "cracha" (token) usado depois do login.
 * Sem bibliotecas externas: usa so o que vem no proprio Java.
 */
@Component
public class Seguranca {

    private final Banco banco;
    private final ObjectMapper json = new ObjectMapper();
    private static final SecureRandom RNG = new SecureRandom();

    public Seguranca(Banco banco) {
        this.banco = banco;
    }

    // ---------- utilitarios estaticos (usados tambem na carga inicial) ----------

    public static String hexAleatorio(int bytes) {
        byte[] b = new byte[bytes];
        RNG.nextBytes(b);
        return paraHex(b);
    }

    public static String paraHex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    public static byte[] deHex(String s) {
        int n = s.length();
        byte[] out = new byte[n / 2];
        for (int i = 0; i < n; i += 2) {
            out[i / 2] = (byte) Integer.parseInt(s.substring(i, i + 2), 16);
        }
        return out;
    }

    /** Gera o hash da senha (PBKDF2) em hexadecimal. */
    public static String hashSenha(String senha, String saltHex) {
        try {
            PBEKeySpec spec = new PBEKeySpec(senha.toCharArray(), deHex(saltHex), 100_000, 512);
            SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return paraHex(f.generateSecret(spec).getEncoded());
        } catch (Exception e) {
            throw new RuntimeException("Falha ao gerar hash da senha", e);
        }
    }

    private static byte[] hmac(String chaveHex, String mensagem) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(deHex(chaveHex), "HmacSHA256"));
            return mac.doFinal(mensagem.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Falha ao assinar token", e);
        }
    }

    // ---------- token (cracha) ----------

    public String gerarToken() {
        try {
            Map<String, Object> dados = new LinkedHashMap<>();
            dados.put("u", banco.getConfig("admin_usuario", "admin"));
            dados.put("exp", System.currentTimeMillis() + 1000L * 60 * 60 * 12); // 12 horas
            String payload = Base64.getEncoder().encodeToString(
                    json.writeValueAsBytes(dados));
            String assinatura = paraHex(hmac(banco.getConfig("auth_secret", ""), payload));
            return payload + "." + assinatura;
        } catch (Exception e) {
            throw new RuntimeException("Falha ao gerar token", e);
        }
    }

    @SuppressWarnings("unchecked")
    public boolean validarToken(String token) {
        if (token == null || token.isEmpty()) return false;
        int ponto = token.indexOf('.');
        if (ponto <= 0) return false;
        String payload = token.substring(0, ponto);
        String assinatura = token.substring(ponto + 1);
        String esperado = paraHex(hmac(banco.getConfig("auth_secret", ""), payload));
        if (!MessageDigest.isEqual(esperado.getBytes(StandardCharsets.UTF_8),
                assinatura.getBytes(StandardCharsets.UTF_8))) {
            return false;
        }
        try {
            byte[] cru = Base64.getDecoder().decode(payload);
            Map<String, Object> dados = json.readValue(cru, Map.class);
            Object exp = dados.get("exp");
            long expMs = (exp instanceof Number) ? ((Number) exp).longValue()
                    : Long.parseLong(String.valueOf(exp));
            return expMs > System.currentTimeMillis();
        } catch (Exception e) {
            return false;
        }
    }

    // ---------- login / troca de senha ----------

    public boolean verificarSenha(String senha) {
        String salt = banco.getConfig("admin_salt", "");
        String hash = banco.getConfig("admin_hash", "");
        if (salt.isEmpty() || hash.isEmpty()) return false;
        String calc = hashSenha(senha == null ? "" : senha, salt);
        return MessageDigest.isEqual(calc.getBytes(StandardCharsets.UTF_8),
                hash.getBytes(StandardCharsets.UTF_8));
    }

    public void trocarSenha(String nova) {
        String novoSalt = hexAleatorio(16);
        banco.setConfig("admin_salt", novoSalt);
        banco.setConfig("admin_hash", hashSenha(nova, novoSalt));
    }
}
