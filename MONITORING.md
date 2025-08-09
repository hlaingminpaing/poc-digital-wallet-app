# Monitoring Setup

This document outlines the monitoring setup for the digital wallet application. The backend services are monitored using Prometheus, while the frontend is not currently configured with an Application Performance Monitoring (APM) tool like New Relic.

## Backend Services Monitoring with Prometheus

All backend microservices (`users-service`, `transactions-service`, `transfer-service`, `wallet-service`) are instrumented with `prom-client`, a Prometheus client for Node.js. They expose a `/metrics` endpoint that the Prometheus server scrapes to collect metrics.

### How it Works

1.  **Instrumentation**: Each service uses `prom-client` to define and expose custom metrics (e.g., HTTP request latency, error rates).
2.  **Metrics Endpoint**: An HTTP server within each service exposes these metrics at the `/metrics` endpoint.
3.  **Prometheus Server**: A Prometheus server is configured to "scrape" (poll) this endpoint on each service instance at regular intervals. The configuration for this is located in the `/prometheus` directory.
4.  **Alerting**: The `prometheus/alert-rules.yml` file contains rules that define alert conditions. If a metric value crosses a defined threshold, Prometheus fires an alert, which can be sent to a tool like Alertmanager.

### Viewing Metrics

To monitor the services with Prometheus, you need to have the Prometheus server running and configured to scrape the services. Once set up, you can access the Prometheus UI (usually at `http://<prometheus-server-ip>:9090`) to:
-   Query metrics using the Prometheus Query Language (PromQL).
-   Create dashboards to visualize data.
-   View the status of scrape targets.

---

## Frontend Monitoring with New Relic (Future Integration)

The frontend is **not** currently integrated with New Relic. To enable New Relic Browser monitoring, you would need to perform the following steps:

### 1. Set Up New Relic

-   Sign up for a New Relic account at [newrelic.com](https://newrelic.com).
-   In the New Relic UI, go to **Add Data** -> **Browser Monitoring** and follow the wizard to create a new browser application.
-   New Relic will provide you with a JavaScript snippet. This snippet needs to be injected into the `<head>` section of your `frontend/index.html` file.

### 2. Add New Relic Keys to GitLab CI/CD

To manage your New Relic license key and other configuration securely, you should add them as protected CI/CD variables in your GitLab project.

1.  In your GitLab project, go to **Settings** -> **CI/CD**.
2.  Expand the **Variables** section.
3.  Click **Add variable** and add the following:
    -   **`NEW_RELIC_LICENSE_KEY`**: Your New Relic license key.
    -   **`NEW_RELIC_ACCOUNT_ID`**: Your New Relic account ID.
    -   **`NEW_RELIC_BROWSER_APP_ID`**: The application ID for your New Relic browser app.

    **Important**: Mark these variables as **Protected** to ensure they are only exposed to protected branches (like `main`). It is also good practice to **Mask** them so they don't appear in job logs.

### 3. Instrument the Frontend Application

You would need to modify your build process to inject the New Relic JavaScript snippet into your `index.html`. This can be done in several ways, for example:

-   **Manual Injection**: For a quick setup, you can paste the snippet directly into `frontend/index.html`. However, this is not ideal as it exposes your keys in the source code.
-   **Dynamic Injection during CI/CD**: A better approach is to use environment variables to inject the script during the build process in your `.gitlab-ci.yml`. You could use a tool like `sed` to replace placeholder values in your `index.html` with the GitLab CI/CD variables.

Example of a placeholder in `frontend/index.html`:

```html
<head>
    <!-- NEW_RELIC_BROWSER_SNIPPET -->
</head>
```

Example of a script in your `.gitlab-ci.yml` `build-frontend` job:

```yaml
build-frontend:
  # ... existing config ...
  script:
    - |
      # Fetch the New Relic snippet using the API (more secure)
      # Or replace placeholders if you have the snippet template
      sed -i "s|<!-- NEW_RELIC_BROWSER_SNIPPET -->|<!-- Paste Snippet Here and configure with vars -->|" public/index.html
    - docker build -t "${IMAGE_NAME_PREFIX}/${SERVICE_NAME}:${CI_COMMIT_SHA}" .
```

### 4. How to Monitor in New Relic

Once the frontend is instrumented and deployed, data will start appearing in your New Relic account.

1.  Log in to your New Relic account.
2.  Navigate to **Browser** in the top menu.
3.  Select your application from the list.
4.  From here, you can monitor:
    -   **Page load times**: Analyze how long it takes for your pages to load and become interactive.
    -   **JavaScript errors**: Track and debug errors occurring in your users' browsers.
    -   **AJAX requests**: Monitor the performance of your frontend's API calls to the backend services.
    -   **Session traces**: Get detailed waterfall charts of the entire loading process for a single page view.
