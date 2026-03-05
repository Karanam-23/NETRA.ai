import os
import sys
import firebase_admin
from firebase_admin import credentials, auth, firestore

# Determine the path to serviceAccountKey.json
# It should be in the parent directory of this script's directory (i.e. netra-backend/)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
key_path = os.path.join(parent_dir, 'serviceAccountKey.json')

if not os.path.exists(key_path):
    print(f"Error: serviceAccountKey.json not found at {key_path}")
    print("Please ensure the service account key is placed in the netra-backend directory.")
    sys.exit(1)

# Initialize Firebase Admin SDK
cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred)

db = firestore.client()

DEMO_ORG_ID = "demo_org_001"

# 1. Create Demo Organization
org_ref = db.collection('organizations').document(DEMO_ORG_ID)
org_doc = org_ref.get()

# We need the admin uid later, we will set it when we process the org_admin user
if not org_doc.exists:
    org_ref.set({
        'orgId': DEMO_ORG_ID,
        'name': 'Netra.AI Demo',
        'plan': 'Pro',
        'adminUid': '', # Will be updated
        'cameraCount': 0,
        'alertSettings': {
            'escalationTimeoutSeconds': 60,
            'dedupWindowSeconds': 30,
            'defaultConfidenceThreshold': 0.75
        }
    })
    print(f"Created demo organization: {DEMO_ORG_ID}")
else:
    print(f"Demo organization {DEMO_ORG_ID} already exists.")

# Demo Users Configuration
demo_users = [
    {
        "email": "superadmin@netra.ai",
        "password": "Demo@1234",
        "role": "super_admin",
        "displayName": "Super Admin"
    },
    {
        "email": "admin@netra.ai",
        "password": "Demo@1234",
        "role": "org_admin",
        "displayName": "Org Admin"
    },
    {
        "email": "operator@netra.ai",
        "password": "Demo@1234",
        "role": "operator",
        "displayName": "Operator"
    },
    {
        "email": "viewer@netra.ai",
        "password": "Demo@1234",
        "role": "viewer",
        "displayName": "Viewer"
    }
]

admin_uid = None

# Process each user
for user_data in demo_users:
    email = user_data["email"]
    password = user_data["password"]
    role = user_data["role"]
    display_name = user_data["displayName"]

    try:
        # Check if user already exists
        user = auth.get_user_by_email(email)
        print(f"User {email} already exists (UID: {user.uid}). Skipping Auth creation, but checking claims/Firestore.")
        uid = user.uid
    except firebase_admin.exceptions.NotFoundError:
        # Create user
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name
        )
        uid = user.uid
        print(f"Created Firebase Auth user: {email} (UID: {uid})")
    except Exception as e:
        print(f"Error checking/creating user {email}: {e}")
        continue

    # Set Custom Claims
    try:
        auth.set_custom_user_claims(uid, {
            'orgId': DEMO_ORG_ID,
            'role': role
        })
        print(f"  - Set custom claims for {email} (orgId: {DEMO_ORG_ID}, role: {role})")
    except Exception as e:
        print(f"  - Error setting custom claims for {email}: {e}")

    # Create/Update Firestore document
    try:
        user_ref = db.collection('users').document(uid)
        user_ref.set({
            'email': email,
            'displayName': display_name,
            'role': role,
            'orgId': DEMO_ORG_ID,
            'notifyViaSMS': False,
            'uid': uid
        }, merge=True)
        print(f"  - Upserted Firestore document for {email}")
        
        # Save admin UID to update org document later
        if role == "org_admin":
            admin_uid = uid
            
    except Exception as e:
        print(f"  - Error creating Firestore document for {email}: {e}")

# Update Demo Organization with adminUid if we found/created the org_admin
if admin_uid:
    try:
        org_ref.update({'adminUid': admin_uid})
        print(f"\nUpdated organization {DEMO_ORG_ID} with adminUid: {admin_uid}")
    except Exception as e:
        print(f"Error updating organization adminUid: {e}")

print("\nDemo users creation script completed.")
