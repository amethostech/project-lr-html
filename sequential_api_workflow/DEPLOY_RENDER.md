# Python Backend Deployment Guide (Render)

## Prerequisites
- Python 3.9+
- `requirements.txt` file

## Step 1: Create requirements.txt
Create `/home/anurag/Desktop/project-lr/sequential_api_workflow/requirements.txt`:
```
fastapi
uvicorn
requests
python-dotenv
```

## Step 2: Create Render Web Service
1. Go to [render.com](https://render.com) → Dashboard → **New** → **Web Service**
2. Connect your GitHub repository

## Step 3: Configure Service
| Setting | Value |
|---------|-------|
| **Name** | `project-lr-python` |
| **Root Directory** | `sequential_api_workflow` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn js_api_wrapper:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Free |

## Step 4: Environment Variables
In Render dashboard → Environment → Add:
| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11` |

## Step 5: Deploy
Click **Create Web Service** and wait for deployment.

## Step 6: Update Frontend .env
After deployment, update `.env` in frontend:
```
VITE_NODE_BACKEND_URL=https://project-lr-html.onrender.com
VITE_PYTHON_BACKEND_URL=https://project-lr-python.onrender.com
```

## Step 7: Update Node.js Backend CORS
Add the deployed Python backend URL to CORS allowed origins in `/Backend/app.js` if needed.

## Notes
- Free tier spins down after 15 mins of inactivity
- First request after spin-up takes ~30 seconds
- Consider upgrading to paid tier for faster cold starts
