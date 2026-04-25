import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (config.get<string>('SWAGGER_ENABLED', 'true') === 'true') {
    const documentConfig = new DocumentBuilder()
      .setTitle('CodeGuard AI Analysis Service')
      .setDescription(
        'Internal API for persistence, Redis Streams queue publication, worker callbacks, scan lifecycle, risk scoring and enterprise evidence retrieval.',
      )
      .setVersion('0.1.0')
      .addServer('http://localhost:3002', 'Local Analysis Service')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'x-internal-secret',
          in: 'header',
          description: 'Required for protected worker callback endpoints under /internal.',
        },
        'internal-secret',
      )
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: {
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
    });
  }

  const port = config.get<number>('PORT') ?? config.get<number>('ANALYSIS_SERVICE_PORT') ?? 3002;
  await app.listen(port);
}

void bootstrap();
