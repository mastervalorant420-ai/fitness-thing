// src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:3000';

export function useSocket(userId) {
  const socketRef              = useRef(null);
  const [connected, setConnected]   = useState(false);
  const [activities, setActivities] = useState([]);
  const [verifiedLogs, setVerifiedLogs] = useState([]);

  const addActivity = useCallback((payload) => {
    setActivities((prev) => [{ ...payload, _id: Date.now() }, ...prev].slice(0, 50));
  }, []);

  const addVerified = useCallback((payload) => {
    setVerifiedLogs((prev) => [{ ...payload, _id: Date.now() }, ...prev].slice(0, 50));
    // Also mark any matching feed item as verified
    setActivities((prev) =>
      prev.map((a) =>
        a.log_id === payload.log_id ? { ...a, _verified: true } : a
      )
    );
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (userId) socket.emit('JOIN_USER_ROOM', userId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('GLOBAL_ACTIVITY', addActivity);
    socket.on('LOG_VERIFIED', addVerified);

    return () => {
      socket.disconnect();
    };
  }, [userId, addActivity, addVerified]);

  return { connected, activities, verifiedLogs };
}
