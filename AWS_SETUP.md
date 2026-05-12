# Setup Deployments: Next.js Frontend + Node.js Backend

This guide covers deploying the two-folder structure. Since AWS App Runner is deprecated, the easiest approach that gives you a "Render-style" no-hassle setup is to simply use **Render** for the backend and **AWS Amplify** (or Vercel) for the frontend.

## 1. Backend (Node.js) Deployment - Render.com
Render is the absolute easiest way to deploy a Node.js WebSocket backend securely. It handles HTTPS/WSS automatically.

1. Go to **Render.com** and create a New **Web Service**.
2. Connect your GitHub repository.
3. **Root Directory**: ackend
4. **Environment**: Node
5. **Build Command**: 
pm install
6. **Start Command**: 
pm start *(or 
ode server.js)*
7. Click **Advanced** -> Add Environment Variables:
   - MEETING_BAAS_API_KEY = your_key
   - GEMINI_API_KEY = your_key
   - *(Wait to set PUBLIC_URL until Render finishes building and gives you your .onrender.com domain. Once it does, add PUBLIC_URL=https://your-service.onrender.com and hit Save).*
8. Click **Create Web Service**.

That's it! Render automatically provisions the SSL certificates so WebSockets (wss://) work out of the box.

## 2. Frontend (Next.js) Deployment - AWS Amplify
Amplify Hosting manages Next.js SSR apps seamlessly.

1. Go to AWS Amplify Console > Create new App.
2. Connect your Git repository (GitHub/GitLab/etc).
3. Select the rontend directory as the build path or use this Build setting:
   `yaml
   version: 1
   applications:
     - appRoot: frontend
       frontend:
         phases:
           preBuild:
             commands:
               - npm ci
           build:
             commands:
               - npm run build
         artifacts:
           baseDirectory: .next
           files:
             - '**/*'
         cache:
           paths:
             - node_modules/**/*
   `
4. Set the Environment Variable in Amplify:
   - NEXT_PUBLIC_BACKEND_URL = https://your-service.onrender.com 
   - *(Set this to the exact domain Render gave you in Step 1. This tells Next.js where your backend lives).*
5. Click **Save and Deploy**.
