
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer, { type SendMailOptions } from "nodemailer";

import { config } from "../config.js";

const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets",
);

const GOOD_PRACTICES_IMAGE = path.join(
  ASSETS_DIR,
  "boas_praticas_kimovil.png",
);

// Adicione esse arquivo à pasta assets quando a logo estiver pronta.
const LOGO_IMAGE = path.join(ASSETS_DIR, "ki-logo.png");

const SUBJECT = "Cadastro registrado com sucesso - Kimovil";

const TEXT = `Olá!

Seu cadastro para liberação de entrada foi registrado com sucesso!

A equipe Kimovil deseja a você e aos seus convidados uma ótima estadia, com conforto, tranquilidade e bons momentos.

Pedimos que leia atentamente as recomendações de boas práticas apresentadas abaixo e siga as orientações para ajudar a preservar o imóvel e manter uma boa convivência durante sua estadia.

Em caso de dúvidas ou necessidades relacionadas ao imóvel, entre em contato diretamente com os responsáveis pela locação, pelos canais de atendimento disponibilizados.

Agradecemos pela atenção e desejamos uma excelente estadia!

Atenciosamente,
Equipe Kimovil
`;

const HTML = (hasLogo: boolean) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:#24364b;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    border="0" style="background-color:#eef1f5;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
          border="0" style="width:100%;max-width:600px;background-color:#ffffff;">

          <!-- Cabeçalho da marca -->
          <tr>
            <td align="center"
              style="background-color:#173b59;padding:26px 20px;">
              ${
                hasLogo
                  ? `<img src="cid:kimovil-logo"
                      alt="Kimovil"
                      width="110"
                      style="display:block;width:110px;max-width:100%;height:auto;border:0;">`
                  : `<div style="font-size:34px;font-weight:bold;letter-spacing:2px;color:#ffffff;">
                      KIMOVIL
                    </div>
                    <div style="font-size:12px;color:#d7e3ef;margin-top:6px;">
                      Tecnologia e tranquilidade para sua estadia
                    </div>`
              }
            </td>
          </tr>

          <!-- Faixa de boas-vindas -->
          <tr>
            <td align="center"
              style="background-color:#20517d;padding:28px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.4;font-weight:600;">
                Cadastro registrado com sucesso!
              </h1>
              <p style="margin:10px 0 0;color:#ffffff;font-size:14px;line-height:1.6;">
                Orientações para uma ótima estadia
              </p>
            </td>
          </tr>

          <!-- Mensagem -->
          <tr>
            <td style="padding:30px 28px 24px;font-size:15px;line-height:1.8;color:#34465a;">

              <p style="margin:0 0 18px;">Olá!</p>

              <p style="margin:0 0 18px;">
                Seu cadastro para liberação de entrada foi registrado com sucesso!
              </p>

              <p style="margin:0 0 18px;">
                A equipe <strong>Kimovil</strong> deseja a você e aos seus
                convidados uma ótima estadia, com conforto, tranquilidade
                e bons momentos.
              </p>

              <p style="margin:0 0 20px;">
                Para contribuir com uma locação tranquila,
                <strong>pedimos que leia atentamente as recomendações abaixo</strong>
                e siga as boas práticas apresentadas, ajudando a preservar
                o imóvel e a manter uma boa convivência durante sua estadia.
              </p>

            </td>
          </tr>

          <!-- Imagem incorporada ao corpo -->
          <tr>
            <td align="center" style="padding:0 20px 28px;">
              <img
                src="cid:boas-praticas"
                alt="Guia de boas práticas para uma estadia tranquila"
                width="560"
                style="display:block;width:100%;max-width:560px;height:auto;border:0;"
              >
            </td>
          </tr>

          <!-- Encerramento -->
          <tr>
            <td style="padding:0 28px 30px;font-size:15px;line-height:1.8;color:#34465a;">

              <p style="margin:0 0 18px;">
                Em caso de dúvidas ou necessidades relacionadas ao imóvel,
                entre em contato diretamente com os responsáveis pela locação,
                pelos canais de atendimento disponibilizados.
              </p>

              <p style="margin:0 0 18px;">
                Agradecemos pela atenção e desejamos uma excelente estadia!
              </p>

              <p style="margin:0;">
                Atenciosamente,<br>
                <strong style="color:#173b59;">Equipe Kimovil</strong>
              </p>

            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td align="center"
              style="background-color:#f3f5f8;padding:22px 20px;color:#718096;font-size:11px;line-height:1.7;">
              <p style="margin:0 0 8px;">
                Esta mensagem foi enviada pela equipe Kimovil.
              </p>
              <p style="margin:0;">
                Em caso de dúvidas relacionadas ao imóvel, utilize os canais
                de atendimento dos responsáveis pela locação.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center"
              style="background-color:#173b59;padding:14px 20px;color:#ffffff;font-size:11px;">
              &copy; ${new Date().getFullYear()} Kimovil. Todos os direitos reservados.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;

const transporter =
  config.mail.host && config.mail.user && config.mail.password
    ? nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.secure,
        auth: {
          user: config.mail.user,
          pass: config.mail.password,
        },
      })
    : null;

/**
 * Envia o e-mail de boas práticas após o cadastro.
 * Uma falha no envio não deve invalidar um cadastro já concluído.
 */
export async function sendGoodPracticesEmail(
  to: string,
): Promise<void> {
  if (!transporter || !config.mail.user) {
    console.warn(
      "E-mail de boas práticas não enviado: configuração de e-mail incompleta.",
    );
    return;
  }

  if (!fs.existsSync(GOOD_PRACTICES_IMAGE)) {
    console.error(
      "E-mail de boas práticas não enviado: imagem não encontrada:",
      GOOD_PRACTICES_IMAGE,
    );
    return;
  }

  const hasLogo = fs.existsSync(LOGO_IMAGE);

  const attachments: NonNullable<SendMailOptions["attachments"]> = [
    {
      filename: "boas_praticas_kimovil.png",
      path: GOOD_PRACTICES_IMAGE,
      contentType: "image/png",
      cid: "boas-praticas",
      contentDisposition: "inline",
    },
  ];

  // A logo é opcional até ser adicionada aos assets.
  if (hasLogo) {
    attachments.push({
      filename: "kimovil_logo.png",
      path: LOGO_IMAGE,
      contentType: "image/png",
      cid: "kimovil-logo",
      contentDisposition: "inline",
    });
  }

  try {
    await transporter.sendMail({
      from: {
        name: config.mail.fromName,
        address: config.mail.user,
      },
      to,
      subject: SUBJECT,
      text: TEXT,
      html: HTML(hasLogo),
      attachments,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(
      "Falha ao enviar o e-mail de boas práticas:",
      message,
    );
  }
}
