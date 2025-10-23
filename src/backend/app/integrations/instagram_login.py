"""
Instagram API with Instagram Login integration.
Uses graph.instagram.com, not graph.facebook.com.
"""
import os
import httpx
from typing import Optional, Dict, Any

BASE_URL = "https://graph.instagram.com"
API_VERSION = "v21.0"

def get_auth_url(redirect_uri: str, state: str) -> str:
    """Generate Instagram Login authorization URL."""
    app_id = os.getenv("META_INSTAGRAM_APP_ID")
    scopes = [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments"
    ]
    return (
        f"https://www.instagram.com/oauth/authorize"
        f"?client_id={app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={','.join(scopes)}"
        f"&response_type=code"
        f"&state={state}"
    )

async def exchange_code_for_token(code: str, redirect_uri: str) -> Dict[str, Any]:
    """Exchange authorization code for short-lived access token."""
    app_id = os.getenv("META_INSTAGRAM_APP_ID")
    app_secret = os.getenv("META_INSTAGRAM_APP_SECRET")
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": app_id,
                "client_secret": app_secret,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code
            }
        )
        resp.raise_for_status()
        data = resp.json()
        # Returns: {"access_token": "...", "user_id": "...", "permissions": "..."}
        return data

async def exchange_for_long_lived_token(short_token: str) -> Dict[str, Any]:
    """Exchange short-lived token for long-lived (60 days)."""
    app_secret = os.getenv("META_INSTAGRAM_APP_SECRET")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": app_secret,
                "access_token": short_token
            }
        )
        resp.raise_for_status()
        data = resp.json()
        # Returns: {"access_token": "...", "token_type": "bearer", "expires_in": 5183944}
        return data

async def refresh_long_lived_token(token: str) -> Dict[str, Any]:
    """Refresh long-lived token (must be 24hrs+ old)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/refresh_access_token",
            params={
                "grant_type": "ig_refresh_token",
                "access_token": token
            }
        )
        resp.raise_for_status()
        return resp.json()

async def get_user_profile(access_token: str) -> Dict[str, Any]:
    """Get Instagram professional account profile."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/{API_VERSION}/me",
            params={
                "fields": "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
                "access_token": access_token
            }
        )
        resp.raise_for_status()
        return resp.json()

async def get_user_media(ig_user_id: str, access_token: str, limit: int = 25) -> Dict[str, Any]:
    """Get user's media objects (posts/reels)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/{API_VERSION}/{ig_user_id}/media",
            params={
                "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,media_product_type",
                "limit": limit,
                "access_token": access_token
            }
        )
        resp.raise_for_status()
        return resp.json()

async def send_message(ig_user_id: str, recipient_igsid: str, message: Dict[str, Any], access_token: str) -> Dict[str, Any]:
    """Send a message to Instagram user."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/{API_VERSION}/{ig_user_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "recipient": {"id": recipient_igsid},
                "message": message
            }
        )
        resp.raise_for_status()
        return resp.json()

async def create_media_container(ig_user_id: str, access_token: str, **kwargs) -> Dict[str, Any]:
    """Create media container for publishing."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/{API_VERSION}/{ig_user_id}/media",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=kwargs
        )
        resp.raise_for_status()
        return resp.json()

async def publish_media_container(ig_user_id: str, container_id: str, access_token: str) -> Dict[str, Any]:
    """Publish media container."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/{API_VERSION}/{ig_user_id}/media_publish",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={"creation_id": container_id}
        )
        resp.raise_for_status()
        return resp.json()

