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
        
        stage('Dependency Scanning - Snyk') {
            environment {
                SNYK_TOKEN = credentials('snyk-api-token')
            }
            steps {
                script {
                    echo 'Running Snyk dependency scanning...'
                    
                    // Escanear backend (Python)
                    echo 'Scanning Python dependencies...'
                    sh """
                        docker run --rm \
                        -e SNYK_TOKEN=${SNYK_TOKEN} \
                        -v \$(pwd)/backend:/project \
                        -v \$(pwd)/${REPORTS_DIR}:/reports \
                        snyk/snyk:python \
                        snyk test \
                        --file=/project/requirements.txt \
                        --severity-threshold=low \
                        --json \
                        --json-file-output=/reports/snyk-backend.json \
                        || true
                    """
                    
                    // Escanear frontend (Node.js)
                    echo 'Scanning Node.js dependencies...'
                    sh """
                        docker run --rm \
                        -e SNYK_TOKEN=${SNYK_TOKEN} \
                        -v \$(pwd)/frontend:/project \
                        -v \$(pwd)/${REPORTS_DIR}:/reports \
                        snyk/snyk:node \
                        snyk test \
                        --file=/project/package.json \
                        --severity-threshold=low \
                        --json \
                        --json-file-output=/reports/snyk-frontend.json \
                        || true
                    """
                    
                    // Generar reporte combinado en texto
                    sh """
                        docker run --rm \
                        -e SNYK_TOKEN=${SNYK_TOKEN} \
                        -v \$(pwd)/backend:/backend \
                        -v \$(pwd)/frontend:/frontend \
                        -v \$(pwd)/${REPORTS_DIR}:/reports \
                        snyk/snyk:python \
                        sh -c "cd /backend && snyk test --file=requirements.txt --severity-threshold=low > /reports/snyk-backend.txt 2>&1 || true"
                    """
                    
                    sh """
                        docker run --rm \
                        -e SNYK_TOKEN=${SNYK_TOKEN} \
                        -v \$(pwd)/frontend:/frontend \
                        -v \$(pwd)/${REPORTS_DIR}:/reports \
                        snyk/snyk:node \
                        sh -c "cd /frontend && snyk test --file=package.json --severity-threshold=low > /reports/snyk-frontend.txt 2>&1 || true"
                    """
                    
                    // Combinar reportes
                    sh """
                        echo '========================================' > ${REPORTS_DIR}/snyk-report.txt
                        echo 'SNYK DEPENDENCY SCANNING REPORT' >> ${REPORTS_DIR}/snyk-report.txt
                        echo 'Date: \$(date)' >> ${REPORTS_DIR}/snyk-report.txt
                        echo '========================================' >> ${REPORTS_DIR}/snyk-report.txt
                        echo '' >> ${REPORTS_DIR}/snyk-report.txt
                        echo '--- BACKEND (Python) ---' >> ${REPORTS_DIR}/snyk-report.txt
                        cat ${REPORTS_DIR}/snyk-backend.txt >> ${REPORTS_DIR}/snyk-report.txt 2>/dev/null || echo 'No backend report generated' >> ${REPORTS_DIR}/snyk-report.txt
                        echo '' >> ${REPORTS_DIR}/snyk-report.txt
                        echo '--- FRONTEND (Node.js) ---' >> ${REPORTS_DIR}/snyk-report.txt
                        cat ${REPORTS_DIR}/snyk-frontend.txt >> ${REPORTS_DIR}/snyk-report.txt 2>/dev/null || echo 'No frontend report generated' >> ${REPORTS_DIR}/snyk-report.txt
                    """
                    
                    echo 'Snyk scanning completed. Report saved to reports/snyk-report.txt'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: "${REPORTS_DIR}/snyk-*.txt,${REPORTS_DIR}/snyk-*.json", allowEmptyArchive: true
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
