import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, Form } from "@builder.io/qwik-city";
import { createDB } from "~/db/db";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "@langchain/openai";
import {
  GmailCreateDraft,
  GmailGetMessage,
  GmailGetThread,
  GmailSearch,
  GmailSendMessage
} from "@langchain/community/tools/gmail";
import type { StructuredTool } from "@langchain/core/tools";

// Loader para obtener clínicas con emails
export const useClinicEmails = routeLoader$(async (requestEvent) => {
  const db = createDB(requestEvent);
  const clinicsList = await db.query.clinics.findMany();

  return clinicsList
    .filter(clinic => clinic.email && clinic.email !== 'null')
    .map(clinic => ({
      id: clinic.id,
      name: clinic.name,
      email: clinic.email
    }));
});

// Action para enviar emails
export const useSendEmails = routeAction$(
  async (_data, requestEvent) => {
    try {
      const db = createDB(requestEvent);

      const model = new OpenAI({
        temperature: 0,
        modelName: "gpt-3.5-turbo-1106",
        apiKey: requestEvent.env.get('OPEN_AI')
      });

      const tools: StructuredTool[] = [
        new GmailCreateDraft(),
        new GmailGetMessage(),
        new GmailGetThread(),
        new GmailSearch(),
        new GmailSendMessage(),
      ];

      const gmailAgent = await initializeAgentExecutorWithOptions(tools, model, {
        agentType: "structured-chat-zero-shot-react-description",
        verbose: true,
      });

      const clinics = await db.query.clinics.findMany({
        where: (clinics, { and, ne }) =>
          and(
            ne(clinics.email, 'null'),
            ne(clinics.email, '')
          )
      });

      const results = [];
      const errors = [];

      for (const clinic of clinics) {
        try {
          const draftInput = `Create a gmail draft of a professional business email to ${clinic.name} at ${clinic.email}. 
                              The email should be in Spanish, be formal, mention their services, and propose a business collaboration. 
                              Do not send it yet.`;

          const draftResult = await gmailAgent.invoke({ input: draftInput });

          const sendInput = `Review the latest draft and if it looks good, send it to ${clinic.email}`;
          const sendResult = await gmailAgent.invoke({ input: sendInput });

          results.push({
            clinicName: clinic.name,
            email: clinic.email,
            draftResult,
            sendResult,
            status: 'sent'
          });

        } catch (error) {
          console.error(`Error processing email for ${clinic.name}:`, error);
          errors.push({
            clinicName: clinic.name,
            email: clinic.email,
            error: error instanceof Error ? error.message : "Error desconocido"
          });
        }
      }

      return {
        success: true,
        results,
        errors,
        message: `Emails procesados: ${results.length}, Errores: ${errors.length}`
      };

    } catch (error) {
      console.error("Error in email sending process:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      };
    }
  },
  zod$({})
);
export default component$(() => {
  const clinicEmails = useClinicEmails();
  const sendEmailsAction = useSendEmails();

  const results = sendEmailsAction.value?.results ?? [];
  const errors = sendEmailsAction.value?.errors ?? [];

  return (
    <section class="p-6 bg-gray-50 min-h-screen">
      <div class="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg">
        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">
          Enviar Emails a Clínicas
        </h1>

        {/* Mensaje de Error General */}
        {sendEmailsAction.value?.error && (
          <div 
            class="mb-4 text-red-700 bg-red-100 p-4 rounded border-l-4 border-red-500"
            role="alert"
            aria-live="assertive"
          >
            {sendEmailsAction.value.error}
          </div>
        )}

        {/* Mensaje de Éxito General */}
        {sendEmailsAction.value?.success && (
          <div 
            class="mb-4 text-green-700 bg-green-100 p-4 rounded border-l-4 border-green-500"
            role="alert"
            aria-live="polite"
          >
            {sendEmailsAction.value.message}
          </div>
        )}

        {/* Lista de Clínicas */}
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-4">Clínicas con Email</h2>
          <div class="bg-gray-100 p-4 rounded max-h-60 overflow-y-auto border">
            {clinicEmails.value.length > 0 ? (
              <ul class="list-disc pl-5 space-y-1">
                {clinicEmails.value.map((clinic) => (
                  <li key={clinic.id} class="text-gray-700">
                    <span class="font-medium">{clinic.name}</span> - {clinic.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p class="text-gray-500 italic">No hay clínicas con emails disponibles.</p>
            )}
          </div>
        </div>

        {/* Botón para enviar emails */}
        <Form action={sendEmailsAction} class="space-y-4">
          <button
            type="submit"
            class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-300"
          >
            Enviar Emails
          </button>
        </Form>

        {/* Resultados de los Emails Enviados */}
        {sendEmailsAction.value?.success && (
          <div class="mt-10 space-y-8">
            {/* Emails Enviados */}
            {results.length > 0 && (
              <div class="bg-green-50 p-6 rounded-lg border-l-4 border-green-400">
                <h3 class="text-lg font-semibold text-green-800 mb-3">
                  Emails Enviados ({results.length})
                </h3>
                <ul class="space-y-4">
                  {results.map((result, index) => (
                    <li key={index} class="border-t border-green-200 pt-4">
                      <p class="font-medium">{result.clinicName}</p>
                      <p class="text-sm text-gray-600">{result.email}</p>
                      <div class="mt-1 text-sm text-gray-500">
                        <p>📄 <strong>Borrador:</strong> {result.draftResult.output}</p>
                        <p>📧 <strong>Estado:</strong> {result.sendResult.output}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errores al Enviar Emails */}
            {errors.length > 0 && (
              <div class="bg-red-50 p-6 rounded-lg border-l-4 border-red-400">
                <h3 class="text-lg font-semibold text-red-800 mb-3">
                  Errores al Enviar ({errors.length})
                </h3>
                <ul class="space-y-4">
                  {errors.map((error, index) => (
                    <li key={index} class="border-t border-red-200 pt-4">
                      <p class="font-medium">{error.clinicName}</p>
                      <p class="text-sm text-gray-600">{error.email}</p>
                      <p class="text-sm text-red-600 mt-1">{error.error}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
});