import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc as fbAddDoc, setDoc as fbSetDoc, query, where, onSnapshot as fbOnSnapshot, updateDoc as fbUpdateDoc, deleteDoc as fbDeleteDoc, doc, getDocs as fbGetDocs, serverTimestamp, orderBy } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Retries a Firestore operation if it fails with a transient error.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // Retry on transient errors (e.g., network issues, quota exceeded)
      const isTransient = 
        error.code === 'unavailable' || 
        error.code === 'deadline-exceeded' ||
        error.message?.includes('quota exceeded') ||
        error.message?.includes('the client is offline');
      
      if (!isTransient || i === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw lastError;
}

// Wrapped Firestore functions with error handling and retry
export const addDoc = async (ref: any, data: any) => {
  try {
    return await withRetry(() => fbAddDoc(ref, data));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ref.path);
  }
};

export const setDoc = async (ref: any, data: any, options?: any) => {
  try {
    return await withRetry(() => fbSetDoc(ref, data, options));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ref.path);
  }
};

export const updateDoc = async (ref: any, data: any) => {
  try {
    return await withRetry(() => fbUpdateDoc(ref, data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ref.path);
  }
};

export const deleteDoc = async (ref: any) => {
  try {
    return await withRetry(() => fbDeleteDoc(ref));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ref.path);
  }
};

export const getDocs = async (ref: any) => {
  try {
    return await withRetry(() => fbGetDocs(ref));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ref.path || 'query');
  }
};

export const onSnapshot = (ref: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) => {
  return fbOnSnapshot(ref, onNext, (error) => {
    if (onError) {
      onError(error);
    }
    handleFirestoreError(error, OperationType.GET, ref.path || 'query');
  });
};

export { signInWithPopup, signOut, onAuthStateChanged, collection, query, where, doc, serverTimestamp, orderBy };
export type { User };
