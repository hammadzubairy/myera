import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinarySignSchema } from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { env } from '../env';

const router = Router();

function cloudinaryReady() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    return false;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  return true;
}

router.post('/cloudinary-sign', requireAuth, async (req, res) => {
  const parsed = cloudinarySignSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!cloudinaryReady()) return res.status(503).json({ error: 'Cloudinary is not configured' });

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${parsed.data.folder}/${req.user!.id}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.cloudinaryApiSecret
  );

  return res.json({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    timestamp,
    folder,
    signature,
  });
});

/** Phone and web both send a data URL. The API uploads it, so the client never signs Cloudinary itself. */
router.post('/image', requireAuth, async (req, res) => {
  const parsed = cloudinarySignSchema.safeParse({ folder: req.body?.folder });
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid upload folder' });
  if (!cloudinaryReady()) return res.status(503).json({ error: 'Cloudinary is not configured' });

  const image = String(req.body?.image || '');
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Image data missing' });
  }
  if (image.length > 14_000_000) {
    return res.status(413).json({ error: 'That photo is too large. Try a smaller one.' });
  }

  try {
    const folder = `${parsed.data.folder}/${req.user!.id}`;
    const base = { folder, resource_type: 'image' as const };
    let result;
    try {
      result = await cloudinary.uploader.upload(image, {
        ...base,
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
      });
    } catch {
      result = await cloudinary.uploader.upload(image, base);
    }
    return res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (e: any) {
    const message = e?.message || e?.error?.message || 'Upload failed';
    console.warn('[uploads] cloudinary', message);
    return res.status(502).json({ error: message });
  }
});

export default router;
