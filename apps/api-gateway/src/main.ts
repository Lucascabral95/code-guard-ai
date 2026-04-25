import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get<string>('SWAGGER_ENABLED', 'true') === 'true') {
    const documentConfig = new DocumentBuilder()
      .setTitle('CodeGuard AI API Gateway')
      .setDescription(
        'Public REST facade for CodeGuard AI. The frontend talks only to this gateway; analysis execution remains isolated behind internal services.',
      )
      .setVersion('0.1.0')
      .addServer('http://localhost:3001', 'Local API Gateway')
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

  const port = config.get<number>('PORT') ?? config.get<number>('API_GATEWAY_PORT') ?? 3001;
  await app.listen(port);
}

void bootstrap();
