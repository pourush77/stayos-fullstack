import { Fragment } from 'react';

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(`(${escapedQuery})`, 'ig');

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          return (
            <mark
              key={index}
              style={{
                background: '#E8F1FB',
                color: '#0052AB',
                borderRadius: 4,
                padding: '0 2px',
                fontWeight: 600,
              }}
            >
              {part}
            </mark>
          );
        }

        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
