/**
 * Anti-Cheat QR Code Generator & Parser
 *
 * QR Code tidak berupa link web URL (http/https), melainkan strictly structured
 * secure JSON payload. Hal ini mencegah teknisi menyalin link, bookmark link,
 * atau membuka form dari luar stasiun melalui browser biasa.
 */

export interface QrInspectionPayload {
  app: 'HPIO_INSPECT';
  v: '1.0';
  station_id: string;
  station_code: string;
  room_id: string;
  room_name: string;
  has_climate: boolean;
  checksum: string;
}

export function generateRoomQrPayload(params: {
  station_id: string;
  station_code: string;
  room_id: string;
  room_name: string;
}): string {
  // Check if room name is "Station Area" (case-insensitive)
  const isStationArea = params.room_name.trim().toLowerCase() === 'station area';
  const hasClimate = !isStationArea;

  // Simple deterministic checksum for verification
  const rawSig = `${params.station_id}:${params.room_id}:${params.room_name.toUpperCase()}:HPIO2026`;
  let hash = 0;
  for (let i = 0; i < rawSig.length; i++) {
    hash = (hash << 5) - hash + rawSig.charCodeAt(i);
    hash |= 0;
  }
  const checksum = Math.abs(hash).toString(16).padStart(8, '0');

  const payload: QrInspectionPayload = {
    app: 'HPIO_INSPECT',
    v: '1.0',
    station_id: params.station_id,
    station_code: params.station_code,
    room_id: params.room_id,
    room_name: params.room_name,
    has_climate: hasClimate,
    checksum,
  };

  return JSON.stringify(payload);
}

export function parseAndValidateQrPayload(
  rawText: string,
  expectedStationId?: string
): {
  valid: boolean;
  error?: string;
  data?: QrInspectionPayload;
} {
  try {
    // Detect if user scanned a standard URL
    if (rawText.startsWith('http://') || rawText.startsWith('https://')) {
      return {
        valid: false,
        error: 'QR terdeteksi sebagai URL biasa. Wajib scan QR stiker fisik resmi HPIO!',
      };
    }

    const parsed = JSON.parse(rawText) as QrInspectionPayload;

    if (parsed.app !== 'HPIO_INSPECT') {
      return {
        valid: false,
        error: 'Bukan QR Code resmi sistem inspeksi HPIO.',
      };
    }

    if (!parsed.room_id || !parsed.station_id) {
      return {
        valid: false,
        error: 'Data QR tidak lengkap / format rusak.',
      };
    }

    if (expectedStationId && parsed.station_id !== expectedStationId) {
      return {
        valid: false,
        error: `QR Code ini milik stasiun ${parsed.station_code || 'lain'}, tidak cocok dengan stasiun yang sedang Anda inspeksi!`,
      };
    }

    return {
      valid: true,
      data: parsed,
    };
  } catch {
    return {
      valid: false,
      error: 'QR Code tidak dapat dibaca atau format tidak valid.',
    };
  }
}
