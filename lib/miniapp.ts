/**
 * Mini App SDK integration for Base App
 * Uses @farcaster/miniapp-sdk to get user profile data from Mini App Context
 */

import { sdk } from '@farcaster/miniapp-sdk';

export interface MiniAppUserProfile {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
}

/**
 * Check if the app is opened as a Mini App
 */
export async function isInMiniApp(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    return await sdk.isInMiniApp();
  } catch (error) {
    console.warn('Failed to check Mini App status:', error);
    return false;
  }
}

/**
 * Get user profile data from Mini App Context
 * Returns null if not in Mini App or if context is not available
 */
export async function getMiniAppUserProfile(): Promise<MiniAppUserProfile | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check if we're in a Mini App
    const miniAppStatus = await sdk.isInMiniApp();
    if (!miniAppStatus) {
      console.log('Not in Mini App, user profile not available');
      return null;
    }

    // Get context and extract user info
    console.log('📦 Getting Mini App context...');
    const context = await sdk.context;
    console.log('📦 Mini App context received:', context);
    
    if (!context) {
      console.warn('⚠️ Mini App context is null or undefined');
      return null;
    }
    
    if (!context.user) {
      console.warn('⚠️ Mini App context available but user data is missing. Context keys:', Object.keys(context));
      return null;
    }

    const user = context.user;
    console.log('✅ Got user profile from Mini App context:', {
      fid: user.fid,
      username: user.username,
      displayName: user.displayName,
      pfpUrl: user.pfpUrl,
      hasBio: 'bio' in user,
    });

    // Type assertion to access bio if available (may not be in TypeScript types yet)
    const userWithBio = user as typeof user & { bio?: string };

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.displayName,
      pfpUrl: user.pfpUrl,
      bio: userWithBio.bio,
    };
  } catch (error: any) {
    console.warn('Failed to get user profile from Mini App context:', error);
    return null;
  }
}

/**
 * Get full Mini App context (user, location, client, features)
 */
export async function getMiniAppContext() {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const miniAppStatus = await sdk.isInMiniApp();
    if (!miniAppStatus) {
      return null;
    }

    return await sdk.context;
  } catch (error: any) {
    console.warn('Failed to get Mini App context:', error);
    return null;
  }
}

