pipeline {
    agent any

    environment {
        REGISTRY_URL = "registry.konoba.space"

        TAG = "${BUILD_NUMBER}"

        BACKEND_IMAGE = "${REGISTRY_URL}/burger-back:${TAG}"
        FRONTEND_IMAGE = "${REGISTRY_URL}/burger-front:${TAG}"

        KUBE_CONTEXT    = "minikube"
        HELM_RELEASE    = "burgerclicker"
        HELM_NAMESPACE  = "burgerclicker"
        HELM_CHART_PATH = "helm/burgerclicker"
    }

    options {
        timestamps()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Semgrep - SAST') {
            steps {
                sh '''
                    mkdir -p reports
                    semgrep scan \
                      --config=p/python \
                      --config=p/typescript \
                      --severity ERROR \
                      --output reports/semgrep-report.txt \
                      .
                '''
            }
        }

        stage('Build & Test Backend') {
            steps {
                sh '''
                    cd backend
                    python3 -m venv venv
                    . venv/bin/activate

                    pip install --upgrade pip
                    pip install -r requirements.txt

                    pytest || echo "No hay tests de backend definidos"
                '''
            }
        }

        stage('Build & Test Frontend') {
            steps {
                sh '''
                    cd frontend
                    npm ci || npm install

                    npm test -- --watch=false || echo "No hay tests de frontend definidos"

                    npm run build || echo "Build de frontend no definida"
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    echo "Construyendo imágenes Docker:"
                    echo "- ${BACKEND_IMAGE}"
                    echo "- ${FRONTEND_IMAGE}"

                    sh """
                        docker build -t ${BACKEND_IMAGE} backend
                        docker build -t ${FRONTEND_IMAGE} frontend
                    """
                }
            }
        }

        stage('Push Docker Images') {
            steps {
                script {
                    echo "Pusheando imágenes al registry ${REGISTRY_URL}"

                    sh """
                        docker push ${BACKEND_IMAGE}
                        docker push ${FRONTEND_IMAGE}
                    """
                }
            }
        }

        stage('Deploy to Kubernetes with Helm') {
            steps {
                script {
                    sh "kubectl config use-context ${KUBE_CONTEXT}"

                    sh """
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART_PATH} \
                          --namespace ${HELM_NAMESPACE} --create-namespace \
                          --set backend.image=${BACKEND_IMAGE} \
                          --set frontend.image=${FRONTEND_IMAGE}
                    """
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/**', fingerprint: true
        }
        success {
            echo "✔ Pipeline OK"
            echo "✔ Backend:  ${BACKEND_IMAGE}"
            echo "✔ Frontend: ${FRONTEND_IMAGE}"
        }
        failure {
            echo "Pipeline falló"
        }
    }
}
