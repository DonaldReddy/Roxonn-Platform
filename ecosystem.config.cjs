module.exports = {
  apps: [{
    name: "github-identity-api",
    script: "dist/index.js",
    env_production: {
      // Only keeping NODE_ENV
      NODE_ENV: "production"
    },
    env_file: "./server/.env",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "500M",
    error_file: "/home/ubuntu/logs/github-identity-api-error.log",
    out_file: "/home/ubuntu/logs/github-identity-api-out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
} 