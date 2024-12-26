import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Definición de la tabla
export const clinics = sqliteTable('clinics', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').default('null'),
  phone: text('phone').notNull(),
  email: text('email').notNull(),

  description: text('description').default('null'),
  facebook: text('facebook').default('null'),
  instagram: text('instagram').default('null'),
  twitter: text('twitter').default('null'),
});

// Schema más flexible para la validación
export const insertClinicSchema = z.preprocess(
  // Preprocesar los datos antes de la validación
  (data: any) => {
    // Si data es undefined, crear un objeto vacío
    if (!data) {
      data = {};
    }
    // Asegurarnos de que sea un objeto
    const obj = typeof data === 'object' ? data : {};
    
    // Retornar un objeto con valores por defecto
    return {
      name: obj.name || '',
      phone: obj.phone || '',
      email: obj.email || '',

      address: obj.address || 'null',
      description: obj.description || 'null',
      facebook: obj.facebook || 'null',
      instagram: obj.instagram || 'null',
      twitter: obj.twitter || 'null'
    };
  },
  // El schema actual
  z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string(),

    address: z.string(),
    description: z.string(),
    facebook: z.string(),
    instagram: z.string(),
    twitter: z.string()
  })
);

// Schema para selección
export const selectClinicSchema = createSelectSchema(clinics);
export type Clinic = z.infer<typeof selectClinicSchema>;