'use client';

import React, { useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface LogsWindowProps {
  logs: LogEntry[];
  isVisible: boolean;
  onClose?: () => void;
  language?: 'ru' | 'en';
}

const translations = {
  ru: {
    title: 'Логи анализа',
    waiting: 'Ожидание логов...',
    updating: 'Логи обновляются в реальном времени',
    records: 'записей',
  },
  en: {
    title: 'Analysis Logs',
    waiting: 'Waiting for logs...',
    updating: 'Logs update in real-time',
    records: 'records',
  },
};

export default function LogsWindow({ logs, isVisible, onClose, language = 'ru' }: LogsWindowProps) {
  const t = translations[language];
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isVisible) return null;

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div 
        ref={containerRef}
        className="w-full max-w-4xl h-[80vh] bg-[#0d0f14] border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h2 className="text-xl font-bold text-white">{t.title}</h2>
            <span className="text-sm text-gray-400">({logs.length} {t.records})</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Logs Container */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p>{t.waiting}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors ${getLogColor(log.level)}`}
                >
                  <span className="flex-shrink-0">{getLogIcon(log.level)}</span>
                  <span className="text-gray-500 text-xs flex-shrink-0 w-20">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/50 text-xs text-gray-400 text-center">
          {t.updating}
        </div>
      </div>
    </div>
  );
}


