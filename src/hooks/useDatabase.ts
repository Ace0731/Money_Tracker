import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export const useDatabase = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async <T,>(command: string, args: Record<string, any> = {}): Promise<T> => {
        setLoading(true);
        setError(null);

        try {
            const result = await invoke<T>(command, args);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            console.error(`Command ${command} failed:`, err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { execute, loading, error };
};
