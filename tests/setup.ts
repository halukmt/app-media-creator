import sharp from 'sharp';

// Every Vitest worker renders at the same time: one libvips thread per worker keeps the cores from being
// oversubscribed, which made image tests 5–8× slower in a full run than alone (#77).
sharp.concurrency(1);
