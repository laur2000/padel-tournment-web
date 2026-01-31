import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"George Laurentiu Bogdan" <bogdan.lorenzo11@gmail.com>',
      to: email,
      subject: "Restablece tu contraseña",
      html: `
      <p>Hola,</p>
      <p>Solicitaste restablecer tu contraseña. Haz clic en el siguiente enlace para hacerlo:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Si no solicitaste esto, ignora este correo.</p>
      <p>Este enlace expirará en 1 hora.</p>
    `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

export async function sendWaitlistPromotionEmail(
  email: string,
  meetingId: string,
  place: string,
  startTime: Date
) {
  const meetingLink = `${process.env.NEXTAUTH_URL}/meetings/${meetingId}`;

  const dateStr = new Date(startTime).toLocaleString("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  });

  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"Torneo de Padel" <bogdan.lorenzo11@gmail.com>',
      to: email,
      subject: "¡Has entrado al partido!",
      html: `
        <h1>¡Buenas noticias!</h1>
        <p>Una plaza se ha liberado en el partido en <strong>${place}</strong> el <strong>${dateStr}</strong>.</p>
        <p>Has sido movido de la lista de espera a la lista de jugadores principales.</p>
        <p>Por favor, entra al siguiente enlace para confirmar tu asistencia:</p>
        <p><a href="${meetingLink}">Ver Partido y Confirmar</a></p>
        <p>¡Nos vemos en la pista!</p>
      `,
    });
  } catch (error) {
    console.error("Error sending promotion email:", error);
  }
}

export async function sendReminderEmail(
  email: string,
  meetingId: string,
  place: string,
  startTime: Date
) {
  const meetingLink = `${process.env.NEXTAUTH_URL}/meetings/${meetingId}`;

  const dateStr = new Date(startTime).toLocaleString("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  });

  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"Torneo de Padel" <bogdan.lorenzo11@gmail.com>',
      to: email,
      subject: "Recordatorio: Confirma tu asistencia",
      html: `
        <h1>¡Hola!</h1>
        <p>Tienes un partido pendiente de confirmación en <strong>${place}</strong> el <strong>${dateStr}</strong>.</p>
        <p>Recuerda que debes confirmar tu asistencia para asegurar tu plaza.</p>
        <p>Por favor, entra al siguiente enlace para confirmar:</p>
        <p><a href="${meetingLink}">Confirmar Asistencia</a></p>
        <p>¡Nos vemos en la pista!</p>
      `,
    });
  } catch (error) {
    console.error("Error sending reminder email:", error);
  }
}

export async function sendMatchmakingNotification(
  email: string,
  place: string,
  startTime: Date,
  matches: Array<{
    courtNumber: number;
    teamA: string[];
    teamB: string[];
  }>
) {
  const dateStr = new Date(startTime).toLocaleString("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  });

  const matchesHtml = matches
    .map(
      (m) => `
      <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; background-color: #f9f9f9;">
        <h3 style="margin-top: 0; color: #333;">Pista ${m.courtNumber}</h3>
        <p style="margin: 5px 0;"><strong>Equipo A:</strong> ${m.teamA.join(" y ")}</p>
        <p style="margin: 5px 0; font-weight: bold; text-align: center;">VS</p>
        <p style="margin: 5px 0;"><strong>Equipo B:</strong> ${m.teamB.join(" y ")}</p>
      </div>
    `
    )
    .join("");

  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"Torneo de Padel" <bogdan.lorenzo11@gmail.com>',
      to: email,
      subject: "¡Partidos generados! Tu pista y equipo",
      html: `
        <h1>Partidos Confirmados</h1>
        <p>El partido en <strong>${place}</strong> el <strong>${dateStr}</strong> ha sido cerrado.</p>
        <p>Aquí tienes la distribución de pistas y equipos:</p>
        ${matchesHtml}
        <p>¡Buena suerte y a disfrutar!</p>
      `,
    });
  } catch (error) {
    console.error("Error sending matchmaking email:", error);
  }
}
