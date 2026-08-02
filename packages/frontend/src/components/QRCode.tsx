import { useEffect, useState } from "react";
import QR from "qrcode";

export const QRCode = ({ text, size = 220 }: { text: string; size?: number }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QR.toDataURL(text, { width: size * 2, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (dataUrl === null) return <div className="qr-placeholder" style={{ width: size, height: size }} />;
  return <img className="qr-image" src={dataUrl} width={size} height={size} alt="Join QR code" />;
};
