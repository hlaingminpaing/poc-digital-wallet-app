# GitLab CI/CD Pipeline Documentation

This document provides a detailed explanation of the `.gitlab-ci.yml` pipeline configuration for the digital-wallet project. This pipeline is designed for a GitOps workflow where ArgoCD is responsible for deployment.

## Overview

The CI/CD pipeline automates the testing, security scanning, building, and updating of Kubernetes manifests for the frontend and all backend microservices. It ensures that every change on the default branch is automatically verified, scanned, and prepared for deployment by ArgoCD.

The pipeline is structured into four distinct stages:

1.  **`test`**: Compiles and runs the unit tests for each service.
2.  **`scan`**: Performs static code analysis using SonarQube.
3.  **`build`**: Creates a versioned Docker image for each service and pushes it to Docker Hub.
4.  **`update-manifests`**: Updates the Kubernetes deployment files in the repository with the new image tag.

The pipeline leverages YAML anchors to create reusable templates for jobs within each stage, keeping the configuration DRY (Don't Repeat Yourself) and easy to maintain.

---

## Pipeline Stages and Jobs

### 1. `test` Stage
-   **Purpose**: To validate the correctness of the code by running automated tests.
-   **Jobs**: `test-frontend`, `test-users-service`, etc.
-   **Execution**: Runs `npm install` and `npm test` for each service in parallel. A failure in any job stops the pipeline.

### 2. `scan` Stage
-   **Purpose**: To inspect the code for quality issues, bugs, and vulnerabilities.
-   **Jobs**: `scan-frontend`, `scan-users-service`, etc.
-   **Execution**: This stage runs only on the default branch. It uses the `sonar-scanner-cli` to send the code to a SonarQube server for analysis. Requires `SONAR_HOST_URL` and `SONAR_TOKEN` variables to be configured.

### 3. `build` Stage
-   **Purpose**: To package each service into a portable Docker image and publish it to Docker Hub.
-   **Jobs**: `build-frontend`, `build-users-service`, etc.
-   **Execution**: This stage runs only on the default branch. It builds a Docker image for each service, tags it with the unique commit SHA and `latest`, and pushes both to your Docker Hub account.

### 4. `update-manifests` Stage
-   **Purpose**: To update the Kubernetes manifests with the newly built image tag, completing the GitOps loop.
-   **Job**: `update-manifests`
-   **Execution**:
    -   This stage runs only on the default branch after all services have been built.
    -   It uses `sed` to replace the image tag in each service's corresponding `.yml` file in the `k8s/` directory with the new Docker Hub image.
    -   It then commits and pushes the updated manifests back to the repository.
    -   The commit message includes `[skip ci]` to prevent the pipeline from triggering itself.
    -   Requires a `GIT_DEPLOY_TOKEN` to be configured for repository write access.

---

## CI/CD Variables Setup

For the pipeline to function correctly, you **must** configure several CI/CD variables in your GitLab project settings.

### Required Variables

Navigate to your project's **Settings > CI/CD** and expand the **Variables** section. Add the following variables:

| Key | Value | Type | Protected | Masked | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DOCKERHUB_USERNAME` | `hlaingminpaing` | Variable | Yes | No | Your Docker Hub username. |
| `DOCKERHUB_TOKEN` | `dckr_pat_xxxxxxxxxxxxxxxxxxxx` | Variable | Yes | Yes | A Docker Hub Access Token with Read & Write permissions. |
| `NEW_RELIC_LICENSE_KEY` | `YOUR_NEW_RELIC_LICENSE_KEY` | Variable | Yes | Yes | Your New Relic Browser license key. |
| `NEW_RELIC_BROWSER_APP_ID` | `YOUR_NEW_RELIC_APP_ID` | Variable | Yes | No | The application ID for your New Relic browser app. |
| `NEW_RELIC_BEACON_ID` | `YOUR_NEW_RELIC_BEACON_ID` | Variable | Yes | No | The beacon ID for your New Relic browser app. |
| `NEW_RELIC_ERROR_BEACON_ID` | `YOUR_NEW_RELIC_ERROR_BEACON_ID` | Variable | Yes | No | The error beacon ID for your New Relic browser app. |
| `SONAR_HOST_URL` | `https://your-sonarqube-instance.com` | Variable | Yes | No | The URL of your SonarQube server. |
| `SONAR_TOKEN` | `sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Variable | Yes | Yes | A SonarQube token with "Execute Analysis" permission. |
| `GIT_DEPLOY_TOKEN`| `glpat-xxxxxxxxxxxxxxxxxxxx` | Variable | Yes | Yes | A **GitLab Project Access Token** with `write_repository` scope. Create one under **Settings > Access Tokens**. |

**Note**: It is critical to mark these variables as **Protected** to ensure they are only exposed to protected branches (like `main`) and **Masked** to hide their values in job logs.

### Predefined Variables (Automatic)

The pipeline also uses predefined variables provided by the GitLab runner. You do not need to configure these.

-   `$CI_COMMIT_SHA`, `$CI_COMMIT_BRANCH`, `$CI_DEFAULT_BRANCH`, `$CI_SERVER_HOST`, `$CI_PROJECT_PATH`.

### Internal Variables

These are defined within `.gitlab-ci.yml` for convenience and do not need to be configured in the UI.

-   `$DOCKERHUB_REPO_PREFIX`, `$IMAGE`, `$DOCKER_DRIVER`, `$SERVICE_NAME`, `$SERVICE_PATH`, `$GIT_USER_EMAIL`, `$GIT_USER_NAME`.
