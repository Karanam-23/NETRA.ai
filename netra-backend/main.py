# main.py
import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize Firebase Admin SDK first!
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'netra-ai-433e5.firebasestorage.app',
    'databaseURL': 'https://netra-ai-433e5-default-rtdb.firebaseio.com'
})

# Import celery AFTER Firebase is initialized
from workers.celery_app import celery_app

# Import API routers
from api.routes import auth, cameras, incidents, config, analytics

app = FastAPI(
    title="Netra.AI Control Plane API",
    description="SaaS Backend for CCTV Threat Detection",
    version="1.0.0"
)

# CORS Configuration for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",       # Local development
        "http://localhost:5173",       # Vite dev server
        "https://app.netra.ai"         # Production dashboard
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------ #
#  Register routes                                                    #
# ------------------------------------------------------------------ #

# Auth routes are mounted at root so the frontend can call:
#   POST /onboarding/create-org
#   POST /org/members/invite
#   GET  /org/{orgId}
#   PUT  /org/{orgId}
#   GET  /org/{orgId}/members
#   PATCH /org/{orgId}/members/{uid}
#   DELETE /org/{orgId}/members/{uid}
app.include_router(auth.router, tags=["Auth & Org"])

# Camera routes: POST /cameras/, GET /cameras/?orgId=..., PUT/DELETE /cameras/{id}
app.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])

# Incident routes: GET/PATCH /incidents/{orgId}/..., GET /incidents/{orgId}/export
app.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])

# Config routes: GET/PUT /alerts/config/{orgId}, POST /alerts/test/{cameraId}
app.include_router(config.router, tags=["Config"])

# Analytics routes: GET /analytics/{orgId}/..., GET /dashboard/{orgId}/stats
app.include_router(analytics.router, tags=["Analytics"])

# Zones routes (if module exists)
try:
    from api.routes import zones
    app.include_router(zones.router, prefix="/zones", tags=["Zones"])
except ImportError:
    pass

# Demo route (public, no auth)
from api.routes import demo
app.include_router(demo.router, tags=["Demo"])


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Netra.AI API"}
