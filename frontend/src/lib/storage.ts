// Storage abstraction — swap between Supabase and AWS S3 via VITE_STORAGE_PROVIDER env var

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabase } from './supabase'

const PROVIDER      = (import.meta.env.VITE_STORAGE_PROVIDER as string) || 'supabase'
const S3_REGION     = import.meta.env.VITE_AWS_REGION      as string
const S3_BUCKET     = import.meta.env.VITE_AWS_BUCKET_NAME as string
const S3_ACCESS_KEY = import.meta.env.VITE_AWS_ACCESS_KEY_ID as string
const S3_SECRET_KEY = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY as string
const CF_DOMAIN     = (import.meta.env.VITE_AWS_CLOUDFRONT_DOMAIN as string) || ''

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    })
  }
  return s3Client
}

function s3PublicUrl(key: string): string {
  if (CF_DOMAIN) return `${CF_DOMAIN}/${key}`
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

function s3KeyFromUrl(url: string): string {
  if (CF_DOMAIN && url.startsWith(CF_DOMAIN)) return url.replace(`${CF_DOMAIN}/`, '')
  const marker = '.amazonaws.com/'
  const idx = url.indexOf(marker)
  if (idx !== -1) return url.slice(idx + marker.length).split('?')[0]
  return url
}

function supabasePathFromUrl(url: string): string {
  return url.split('/storage/v1/object/public/media/')[1]?.split('?')[0] ?? url
}

export async function uploadFile(file: File, storagePath: string): Promise<string> {
  return PROVIDER === 's3' ? uploadToS3(file, storagePath) : uploadToSupabase(file, storagePath)
}

async function uploadToSupabase(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(data.path)
  return publicUrl
}

async function uploadToS3(file: File, key: string): Promise<string> {
  const client  = getS3Client()
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: file.type })
  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  const res = await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`)
  return s3PublicUrl(key)
}

export async function deleteFile(publicUrl: string): Promise<void> {
  return PROVIDER === 's3' ? deleteFromS3(publicUrl) : deleteFromSupabase(publicUrl)
}

async function deleteFromSupabase(publicUrl: string): Promise<void> {
  const path = supabasePathFromUrl(publicUrl)
  const { error } = await supabase.storage.from('media').remove([path])
  if (error) throw new Error(error.message)
}

async function deleteFromS3(publicUrl: string): Promise<void> {
  const key    = s3KeyFromUrl(publicUrl)
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

export function getStorageProvider(): 'supabase' | 's3' {
  return PROVIDER === 's3' ? 's3' : 'supabase'
}
