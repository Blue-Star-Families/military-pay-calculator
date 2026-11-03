# Serves the calculator the way GitHub Pages does: static files, no build step.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html bah-data.js zip-data.js social-preview.png /usr/share/nginx/html/
EXPOSE 80
