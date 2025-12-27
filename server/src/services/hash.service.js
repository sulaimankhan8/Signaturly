import crypto from 'crypto';

export const sha256FromBuffer  = (Buffer) => {

    //console.log("Hashing buffer data :", data);
  return crypto.createHash('sha256').update(Buffer).digest('hex');
}