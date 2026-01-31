import nodemailer from "nodemailer";

console.log("SMTP CONFIG:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  user: process.env.SMTP_USER,
  from: process.env.SMTP_FROM,
});

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
    debugger;
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
    debugger;
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
