import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form } from "@builder.io/qwik-city";
import { createDB } from "~/db/db";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { CLINICS_LIST } from "./lista";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Loader para obtener clínicas de la base de datos
export const useClinics = routeLoader$(async (requestEvent) => {
  const db = createDB(requestEvent);
  const clinicsList = await db.query.clinics.findMany();

  return clinicsList.map((clinic) => ({
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    description: clinic.description,
    facebook: clinic.facebook,
    instagram: clinic.instagram,
    twitter: clinic.twitter
  }));
});

function extractEmailFromText(text: string) {
  const emailRegex = /[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}/g;
  const match = text.match(emailRegex);
  return match ? match[0] : 'null';
}

export const useSearchClinics = routeAction$(
  async (_, requestEvent ) => {
    try {
      const tools = [new TavilySearchResults({ maxResults: 3, apiKey: "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" })];

      const prompt = ChatPromptTemplate.fromTemplate(
        `Busca información actual y verificada sobre "{clinicName}" en Medellín, Colombia. 
         Necesito: servicios principales, especialidades médicas, horarios de atención y correo electrónico si están disponibles. 
         Solo incluye información verificada y relevante para esta clínica específica.`
      );
      const llm = new ChatOpenAI({
        modelName: "gpt-3.5-turbo-1106",
        temperature: 0,
        apiKey: requestEvent.env.get('OPEN_AI')
      });

      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
      });

      const processedClinics = [];

      for (const clinic of CLINICS_LIST) {
        try {
          const infoResult = await agentExecutor.invoke({
            input: { clinicName: clinic.name }, // Pasamos el nombre de la clínica
          });

          const socialResult = await agentExecutor.invoke({
            input: `Busca los enlaces oficiales y verificados de redes sociales (Facebook, Instagram, Twitter) y correo electrónico de "${clinic.name}" en Medellín.
                   Solo incluye perfiles verificados y correo electrónico que pertenezcan definitivamente a esta clínica específica.`,
          });

          const socialLinks = extractSocialLinks(socialResult.output);
          const emailFromInfo = extractEmailFromText(infoResult.output);

          const clinicData = {
            name: clinic.name || '',
            phone: clinic.phone || '',
            address: 'Medellín, Colombia',
            description: infoResult.output || 'null',
            facebook: socialLinks.facebook || 'null',
            instagram: socialLinks.instagram || 'null',
            twitter: socialLinks.twitter || 'null',
            email: socialLinks.email || emailFromInfo || 'null'
          };

          if (clinicData.name && clinicData.phone) {
            processedClinics.push(clinicData);
          }

        } catch (error: any) {
          if (error instanceof Error) {
            console.error(`Error processing clinic ${clinic.name}:`, error.message);
          } else {
            console.error(`Error processing clinic ${clinic.name}: Unknown error`);
          }
          continue;
        }
      }

      if (processedClinics.length === 0) {
        throw new Error("No se pudo procesar ninguna clínica");
      }

      console.log("processedClinics: ", JSON.stringify(processedClinics));

      return { 
        success: true, 
        message: `${processedClinics.length} clínicas procesadas con éxito.`,
        clinics: processedClinics 
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error processing clinics:", error.message);
      } else {
        console.error("Error processing clinics: Unknown error");
      }
      return { 
        success: false, 
        error: "Error al procesar las clínicas. Por favor, intente de nuevo." 
      };
    }
  }
);

// Función auxiliar para extraer enlaces de redes sociales del texto
function extractSocialLinks(text: string) {
  const links = {
    facebook: '',
    instagram: '',
    twitter: '',
    email: ''
  };

  try {
    // Buscar URLs de Facebook
    const fbMatch = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[\w\-.]+/);
    if (fbMatch) links.facebook = fbMatch[0];

    // Buscar URLs de Instagram
    const igMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[\w\-.]+/);
    if (igMatch) links.instagram = igMatch[0];

    // Buscar URLs de Twitter
    const twMatch = text.match(/https?:\/\/(?:www\.)?twitter\.com\/[\w\-.]+/);
    if (twMatch) links.twitter = twMatch[0];

    // Buscar email
    const emailMatch = extractEmailFromText(text);
    if (emailMatch) links.email = emailMatch;
  } catch (error) {
    console.error("Error extracting links:", error);
  }

  return links;
}

export default component$(() => {
  const searchAction = useSearchClinics();

  return (
    <section class="p-6 bg-gray-50 min-h-screen">
      <div class="max-w-6xl mx-auto bg-white p-8 shadow-lg rounded-lg">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">Clínicas en Medellín</h1>

        {searchAction.value?.error && (
          <div class="mb-4 text-red-600 bg-red-100 p-3 rounded">
            {searchAction.value.error}
          </div>
        )}

        {searchAction.value?.success && (
          <div class="mb-4 text-green-600 bg-green-100 p-3 rounded">
            {searchAction.value.message}
          </div>
        )}

        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Lista de Clínicas</h2>
          <pre class="bg-gray-100 p-4 rounded overflow-auto max-h-40">
            {JSON.stringify(CLINICS_LIST, null, 2)}
          </pre>
        </div>

        <Form
          action={searchAction}
          class="space-y-4"
        >
          <button 
            type="submit" 
            class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Buscar Información
          </button>
        </Form>

        {searchAction.value?.success && (
          <div class="mt-10 overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-2 text-left">Nombre</th>
                  <th class="px-4 py-2 text-left">Dirección</th>
                  <th class="px-4 py-2 text-left">Teléfono</th>
                  <th class="px-4 py-2 text-left">Email</th>
                  <th class="px-4 py-2 text-left">Descripción</th>
                  <th class="px-4 py-2 text-center">Redes Sociales</th>
                </tr>
              </thead>
              <tbody>
                {searchAction.value?.clinics?.map((clinic, index) => (
                  <tr key={index} class="border-t hover:bg-gray-50">
                    <td class="px-4 py-3">{clinic.name}</td>
                    <td class="px-4 py-3">{clinic.address}</td>
                    <td class="px-4 py-3">{clinic.phone}</td>
                    <td class="px-4 py-3">
                      {clinic.email !== 'null' && (
                        <a
                          href={`mailto:${clinic.email}`}
                          class="text-blue-600 hover:text-blue-800"
                        >
                          {clinic.email}
                        </a>
                      )}
                    </td>
                    <td class="px-4 py-3 max-w-md">{clinic.description}</td>
                    <td class="px-4 py-3">
                      <div class="flex justify-center space-x-4">
                        {clinic.facebook !== 'null' && (
                          <a 
                            href={clinic.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-blue-600 hover:text-blue-800"
                            title="Facebook"
                          >
                            Facebook
                          </a>
                        )}
                        {clinic.instagram !== 'null' && (
                          <a 
                            href={clinic.instagram} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-pink-600 hover:text-pink-800"
                            title="Instagram"
                          >
                            Instagram
                          </a>
                        )}
                        {clinic.twitter !== 'null' && (
                          <a 
                            href={clinic.twitter} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-blue-400 hover:text-blue-600"
                            title="Twitter"
                          >
                            Twitter
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
});
