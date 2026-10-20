package com.fabioimportes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Fabio Importes - Sistema web de gestao de produtos (ERP).
 * Versao em JAVA (Spring Boot) + banco relacional SQLite.
 *
 * Para rodar:  ./mvnw spring-boot:run   (no Windows: mvnw.cmd spring-boot:run)
 * Depois abra: http://localhost:3000   (login: admin / admin123)
 */
@SpringBootApplication
public class FabioImportesApplication {

    public static void main(String[] args) {
        SpringApplication.run(FabioImportesApplication.class, args);
        System.out.println("\n  Fabio Importes rodando em http://localhost:3000");
        System.out.println("  Login padrao: admin / admin123 (troque a senha em Configuracoes).\n");
    }
}
