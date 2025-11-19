pipeline {
    agent any
    
    environment {
        REPORTS_DIR = 'reports'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }
        
        stage('Static Code Analysis - Semgrep') {
            steps {
                script {
                    echo 'Running Semgrep static analysis...'
                    
                    // Crear directorio de reportes
                    sh "mkdir -p ${REPORTS_DIR}"
                    
                    // Ejecutar Semgrep con reglas específicas
                    sh """
                        docker run --rm \
                        -v \$(pwd):/src \
                        returntocorp/semgrep:latest \
                        semgrep scan \
                        --config=p/python \
                        --config=p/typescript \
                        --config=p/security-audit \
                        --config=p/owasp-top-ten \
                        --severity ERROR \
                        --severity WARNING \
                        --json \
                        --output /src/${REPORTS_DIR}/semgrep-report.json \
                        /src
                    """
                    
                    // Convertir JSON a texto legible
                    sh """
                        docker run --rm \
                        -v \$(pwd):/src \
                        returntocorp/semgrep:latest \
                        semgrep scan \
                        --config=p/python \
                        --config=p/typescript \
                        --config=p/security-audit \
                        --config=p/owasp-top-ten \
                        --severity ERROR \
                        --severity WARNING \
                        --output /src/${REPORTS_DIR}/semgrep-report.txt \
                        /src
                    """
                    
                    echo 'Semgrep analysis completed. Report saved to reports/semgrep-report.txt'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: "${REPORTS_DIR}/semgrep-report.*", allowEmptyArchive: true
                }
            }
        }
    }
    
    post {
        always {
            echo 'Pipeline completed'
        }
        failure {
            echo 'Pipeline failed!'
        }
        success {
            echo 'Pipeline succeeded!'
        }
    }
}
