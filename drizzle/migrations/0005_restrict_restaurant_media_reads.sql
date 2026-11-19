DROP POLICY IF EXISTS "Restaurant media is viewable" ON storage.objects;

CREATE POLICY "Owners read own media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'restaurant-media' AND public.owns_media_folder(name));