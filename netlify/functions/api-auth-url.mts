import { Handler } from '@netlify/functions';
import { google } from 'googleapis';

export const handler: Handler = async (event, context) => {
  const redirectUri = event.queryStringParameters?.redirect_uri;
  
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || 'https://coldreach-pro.netlify.app/oauth2callback'
  );

  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    redirect_uri: redirectUri || 'https://coldreach-pro.netlify.app/oauth2callback'
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url }),
  };
};
