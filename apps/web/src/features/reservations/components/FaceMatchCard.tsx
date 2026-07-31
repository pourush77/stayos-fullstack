'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { Camera, RotateCcw, Video, VideoOff } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';

export type FaceCaptureProps = {
  idPhotoUrl?: string;
  onCapture?: (dataUrl: string) => void;
};

/**
 * Live webcam capture card. Renders side-by-side with the ID photo so the
 * receptionist can eyeball a face match. Snapshot is stored client-side only —
 * useful during check-in, discarded on page unload.
 */
export function FaceMatchCard({ idPhotoUrl, onCapture }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | undefined>(undefined);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const startCamera = async () => {
    setError(undefined);
    setIsStarting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera unavailable';
      setError(message);
      showToast({ color: 'red', title: 'Camera blocked', message: 'Please allow camera access in your browser.' });
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const snap = () => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSnapshot(dataUrl);
    onCapture?.(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setSnapshot(undefined);
    void startCamera();
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const tileStyle: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: radius.md,
    minHeight: 220,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Paper radius={radius.lg} p={16} style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 8px 24px rgba(15,23,42,0.035)' }} data-testid="face-match-card">
      <Group justify="space-between" align="center" mb={12}>
        <Group gap={10}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={30}><Camera size={16} /></ThemeIcon>
          <Text fw={800} c="#101828">Face match</Text>
        </Group>
        <Text c="#64748b" size="xs">Snap the guest to compare with the ID photo.</Text>
      </Group>

      <Group grow gap={spacing[3]} align="stretch">
        {/* ID PHOTO */}
        <Stack gap={6}>
          <Text size="xs" fw={700} c="#64748b">ID PHOTO</Text>
          <Box style={tileStyle}>
            {idPhotoUrl ? (
              <Box component="img" src={idPhotoUrl} alt="ID photo" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} />
            ) : (
              <Stack align="center" gap={6}>
                <ThemeIcon size={44} radius="xl" color="gray" variant="light"><Camera size={22} /></ThemeIcon>
                <Text size="xs" c="#94a3b8">Upload ID front first</Text>
              </Stack>
            )}
          </Box>
        </Stack>

        {/* GUEST SNAP */}
        <Stack gap={6}>
          <Text size="xs" fw={700} c="#64748b">GUEST</Text>
          <Box style={tileStyle}>
            {snapshot ? (
              <Box component="img" src={snapshot} alt="Guest snapshot" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} />
            ) : stream ? (
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: 220, objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            ) : (
              <Stack align="center" gap={6}>
                <ThemeIcon size={44} radius="xl" color="gray" variant="light"><Video size={22} /></ThemeIcon>
                <Text size="xs" c="#94a3b8">{error ?? 'Camera off'}</Text>
              </Stack>
            )}
          </Box>
        </Stack>
      </Group>

      <Group justify="flex-end" mt={12} gap={8}>
        {snapshot ? (
          <Button variant="light" color="stayosBrand" leftSection={<RotateCcw size={14} />} onClick={retake} data-testid="face-retake">Retake</Button>
        ) : stream ? (
          <>
            <Button variant="subtle" color="gray" leftSection={<VideoOff size={14} />} onClick={stopCamera}>Stop</Button>
            <Button color="stayosBrand" leftSection={<Camera size={14} />} onClick={snap} data-testid="face-snap">Snap guest</Button>
          </>
        ) : (
          <Button color="stayosBrand" leftSection={<Video size={14} />} loading={isStarting} onClick={() => void startCamera()} data-testid="face-start">Start camera</Button>
        )}
      </Group>
    </Paper>
  );
}
