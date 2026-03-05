"""
api/routes/auth.py
Handles onboarding, user invitations, and organisation management.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from firebase_admin import auth, firestore

from api.dependencies import CurrentUser, get_current_user, require_role

router = APIRouter()
db = firestore.client()


# ------------------------------------------------------------------ #
#  Request / Response Schemas                                         #
# ------------------------------------------------------------------ #

class CreateOrgRequest(BaseModel):
    email: str
    password: str
    displayName: str
    orgName: str


class InviteRequest(BaseModel):
    email: str
    role: str
    orgId: str


class UpdateOrgRequest(BaseModel):
    name: str


# ------------------------------------------------------------------ #
#  POST /onboarding/create-org                                        #
# ------------------------------------------------------------------ #

@router.post("/onboarding/create-org")
def create_org(payload: CreateOrgRequest):
    """
    Public endpoint called during signup.
    1. Creates a Firebase Auth user
    2. Generates an org document in Firestore
    3. Sets custom claims (orgId, role=org_admin)
    4. Creates a user profile document
    """
    org_id = f"org_{uuid.uuid4().hex[:12]}"

    try:
        # 1. Create Firebase Auth user
        user_record = auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.displayName,
        )
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

    try:
        # 2. Set custom claims
        auth.set_custom_user_claims(user_record.uid, {
            "orgId": org_id,
            "role": "org_admin",
        })

        now = datetime.now(timezone.utc)

        # 3. Create org document
        db.collection("orgs").document(org_id).set({
            "name": payload.orgName,
            "plan": "Starter",
            "cameraLimit": 5,
            "cameraCount": 0,
            "createdBy": user_record.uid,
            "createdAt": now,
            "alertSettings": {
                "thresholds": {
                    "Fall": 0.7,
                    "Chasing": 0.6,
                    "Struggle": 0.65,
                    "Zone": 0.5,
                },
                "escalationTimeout": 300,
                "dedupWindow": 60,
            },
        })

        # 4. Create user profile document
        db.collection("users").document(user_record.uid).set({
            "uid": user_record.uid,
            "email": payload.email,
            "displayName": payload.displayName,
            "orgId": org_id,
            "role": "org_admin",
            "notifyViaSMS": False,
            "phone": None,
            "createdAt": now,
        })

        return {
            "uid": user_record.uid,
            "orgId": org_id,
            "message": "Organization created successfully.",
        }

    except Exception as e:
        # Rollback: delete the auth user if Firestore writes fail
        try:
            auth.delete_user(user_record.uid)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Org creation failed: {str(e)}")


# ------------------------------------------------------------------ #
#  POST /org/members/invite                                           #
# ------------------------------------------------------------------ #

@router.post("/org/members/invite")
def invite_member(
    payload: InviteRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """
    Looks up a user by email and stamps them with the caller's orgId and chosen role.
    If the user doesn't exist in Auth yet, creates a placeholder record.
    """
    valid_roles = ["operator", "viewer", "responder", "org_admin"]
    if payload.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    org_id = payload.orgId or current_user.org_id

    try:
        target_user = auth.get_user_by_email(payload.email)
    except auth.UserNotFoundError:
        # Create a shell user so the invite link works when they sign up
        target_user = auth.create_user(email=payload.email)

    # Prevent overwriting users already in another org
    existing_claims = target_user.custom_claims or {}
    if existing_claims.get("orgId") and existing_claims["orgId"] != org_id:
        raise HTTPException(status_code=400, detail="User already belongs to another organization.")

    auth.set_custom_user_claims(target_user.uid, {
        "orgId": org_id,
        "role": payload.role,
    })

    # Upsert user profile document
    db.collection("users").document(target_user.uid).set({
        "uid": target_user.uid,
        "email": payload.email,
        "displayName": target_user.display_name or "",
        "orgId": org_id,
        "role": payload.role,
        "notifyViaSMS": False,
        "phone": None,
        "createdAt": datetime.now(timezone.utc),
    }, merge=True)

    return {"message": f"Successfully invited {payload.email} as {payload.role}."}


# ------------------------------------------------------------------ #
#  GET /org/{orgId}                                                   #
# ------------------------------------------------------------------ #

@router.get("/org/{org_id}")
def get_org(org_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Returns the organisation document."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised to view this organisation.")

    doc = db.collection("orgs").document(org_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Organisation not found.")

    data = doc.to_dict()
    return {
        "id": org_id,
        "name": data.get("name", ""),
        "plan": data.get("plan", "Starter"),
        "cameraCount": data.get("cameraCount", 0),
        "cameraLimit": data.get("cameraLimit", 5),
    }


# ------------------------------------------------------------------ #
#  PUT /org/{orgId}                                                   #
# ------------------------------------------------------------------ #

@router.put("/org/{org_id}")
def update_org(
    org_id: str,
    payload: UpdateOrgRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Update organisation name."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    doc_ref = db.collection("orgs").document(org_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Organisation not found.")

    doc_ref.update({"name": payload.name})
    return {"message": "Organisation updated."}


# ------------------------------------------------------------------ #
#  GET /org/{orgId}/members                                           #
# ------------------------------------------------------------------ #

@router.get("/org/{org_id}/members")
def list_members(org_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """List all users belonging to this org."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    docs = db.collection("users").where("orgId", "==", org_id).stream()
    members = []
    for d in docs:
        u = d.to_dict()
        members.append({
            "uid": u.get("uid", d.id),
            "email": u.get("email", ""),
            "displayName": u.get("displayName", ""),
            "role": u.get("role", "viewer"),
            "notifyViaSMS": u.get("notifyViaSMS", False),
        })
    return members


# ------------------------------------------------------------------ #
#  PATCH /org/{orgId}/members/{uid}                                   #
# ------------------------------------------------------------------ #

@router.patch("/org/{org_id}/members/{uid}")
def update_member(
    org_id: str,
    uid: str,
    updates: dict,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Update a member's profile fields (e.g. notifyViaSMS)."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    allowed_fields = {"notifyViaSMS", "role", "phone", "displayName"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}

    if not filtered:
        raise HTTPException(status_code=400, detail="No valid fields to update.")

    db.collection("users").document(uid).update(filtered)
    return {"message": "Member updated."}


# ------------------------------------------------------------------ #
#  DELETE /org/{orgId}/members/{uid}                                  #
# ------------------------------------------------------------------ #

@router.delete("/org/{org_id}/members/{uid}")
def remove_member(
    org_id: str,
    uid: str,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Remove a member from the org (clear their claims + delete profile)."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")
    if uid == current_user.uid:
        raise HTTPException(status_code=400, detail="Cannot remove yourself.")

    # Check last admin guard
    user_doc = db.collection("users").document(uid).get()
    if user_doc.exists and user_doc.to_dict().get("role") == "org_admin":
        admin_count = len(list(
            db.collection("users")
            .where("orgId", "==", org_id)
            .where("role", "==", "org_admin")
            .stream()
        ))
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last org admin.")

    # Clear Firebase Auth custom claims
    auth.set_custom_user_claims(uid, {})

    # Delete user profile
    db.collection("users").document(uid).delete()

    return {"message": "Member removed."}
