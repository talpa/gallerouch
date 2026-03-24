import React, { useState } from 'react';

interface GalleryFormProps {
  onSubmit: (data: { title: string; description: string; price: number; image: File | null }) => void;
}

const GalleryForm: React.FC<GalleryFormProps> = ({ onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [image, setImage] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, price, image });
  };

  return (
    <form className="gallery-form" onSubmit={handleSubmit}>
      <label>
        Název obrazu:
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
      </label>
      <label>
        Popis:
        <textarea value={description} onChange={e => setDescription(e.target.value)} required />
      </label>
      <label>
        Cena:
        <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min={0} />
      </label>
      <label>
        Obrázek:
        <div>
          <label style={{ cursor: 'pointer', padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', display: 'inline-block', backgroundColor: '#f8f9fa' }}>
            Vybrat soubor
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          </label>
          {image && <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>{image.name}</span>}
        </div>
      </label>
      <button type="submit">Přidat obraz</button>
    </form>
  );
};

export default GalleryForm;
