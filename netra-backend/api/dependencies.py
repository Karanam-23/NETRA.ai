from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth
from pydantic import BaseModel
from typing import List, Callable

security = HTTPBearer()

# Pydantic model representing the authenticated context
class CurrentUser(BaseModel):
    uid: str
    email: str
    org_id: str
    role: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> CurrentUser:
    """
    FastAPI dependency that verifies the Firebase JWT and extracts custom claims.
    """
    token = credentials.credentials
    
    try:
        # Verify the token against Firebase public keys
        decoded_token = auth.verify_id_token(token)
        
        # Extract base fields
        uid = decoded_token.get("uid")
        email = decoded_token.get("email", "")
        
        # Extract Custom Claims
        org_id = decoded_token.get("orgId")
        role = decoded_token.get("role")
        
        if not org_id or not role:
            raise HTTPException(
                status_code=403, 
                detail="User lacks organization or role assignment. Complete onboarding."
            )
            
        return CurrentUser(uid=uid, email=email, org_id=org_id, role=role)
        
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Dependency factory to enforce RBAC based on custom claims.
    """
    def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Operation not permitted. Required roles: {allowed_roles}. Your role: {current_user.role}."
            )
        return current_user
        
    return role_checker
