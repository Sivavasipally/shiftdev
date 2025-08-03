import * as fs from 'fs';
import * as path from 'path';
import { FileUtils } from './fileUtils';

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: 'backend' | 'frontend' | 'fullstack' | 'mobile';
  language: string;
  configFiles: string[];
  patterns: string[];
  dependencies?: string[];
}

export class FrameworkDetector {
  static async detectFrameworks(rootPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    // Detect Java/Spring frameworks
    const springFrameworks = await this.detectSpringFrameworks(rootPath);
    frameworks.push(...springFrameworks);
    
    // Detect JavaScript/TypeScript frameworks
    const jsFrameworks = await this.detectJavaScriptFrameworks(rootPath);
    frameworks.push(...jsFrameworks);
    
    // Detect Python frameworks
    const pythonFrameworks = await this.detectPythonFrameworks(rootPath);
    frameworks.push(...pythonFrameworks);
    
    return frameworks;
  }

  private static async detectSpringFrameworks(rootPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    // Check for Maven project
    const pomPath = path.join(rootPath, 'pom.xml');
    if (await FileUtils.pathExists(pomPath)) {
      const pomContent = await FileUtils.readFileAsync(pomPath);
      
      // Spring Boot detection
      if (pomContent.includes('spring-boot-starter') || pomContent.includes('spring-boot-parent')) {
        const version = this.extractVersionFromPom(pomContent, 'spring-boot');
        frameworks.push({
          name: 'Spring Boot',
          version,
          type: 'backend',
          language: 'java',
          configFiles: ['pom.xml', 'application.properties', 'application.yml'],
          patterns: [
            '@SpringBootApplication', '@RestController', '@Controller', '@Service',
            '@Repository', '@Component', '@Configuration', '@Entity', '@Autowired'
          ],
          dependencies: this.extractDependenciesFromPom(pomContent)
        });
      }
      
      // Spring Framework detection
      if (pomContent.includes('spring-context') || pomContent.includes('spring-core')) {
        const version = this.extractVersionFromPom(pomContent, 'spring');
        frameworks.push({
          name: 'Spring Framework',
          version,
          type: 'backend',
          language: 'java',
          configFiles: ['pom.xml', 'applicationContext.xml', 'spring-config.xml'],
          patterns: [
            '@Component', '@Service', '@Repository', '@Controller',
            '@Autowired', '@Qualifier', '@Value', '@Configuration'
          ],
          dependencies: this.extractDependenciesFromPom(pomContent)
        });
      }
      
      // Spring Security
      if (pomContent.includes('spring-security')) {
        frameworks.push({
          name: 'Spring Security',
          version: this.extractVersionFromPom(pomContent, 'spring-security'),
          type: 'backend',
          language: 'java',
          configFiles: ['security-config.xml', 'WebSecurityConfig.java'],
          patterns: ['@EnableWebSecurity', '@PreAuthorize', '@PostAuthorize', '@Secured']
        });
      }
      
      // Spring Data JPA
      if (pomContent.includes('spring-data-jpa')) {
        frameworks.push({
          name: 'Spring Data JPA',
          version: this.extractVersionFromPom(pomContent, 'spring-data-jpa'),
          type: 'backend',
          language: 'java',
          configFiles: ['persistence.xml', 'jpa-config.xml'],
          patterns: ['@Entity', '@Repository', '@Query', '@JoinColumn', '@OneToMany', '@ManyToOne']
        });
      }
    }
    
    // Check for Gradle project
    const gradlePath = path.join(rootPath, 'build.gradle');
    if (await FileUtils.pathExists(gradlePath)) {
      const gradleContent = await FileUtils.readFileAsync(gradlePath);
      
      if (gradleContent.includes('spring-boot-starter')) {
        frameworks.push({
          name: 'Spring Boot (Gradle)',
          type: 'backend',
          language: 'java',
          configFiles: ['build.gradle', 'application.properties', 'application.yml'],
          patterns: ['@SpringBootApplication', '@RestController', '@Service', '@Repository']
        });
      }
    }
    
    return frameworks;
  }

  private static async detectJavaScriptFrameworks(rootPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    // Check package.json
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (await FileUtils.pathExists(packageJsonPath)) {
      const packageContent = await FileUtils.readFileAsync(packageJsonPath);
      const packageJson = JSON.parse(packageContent);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // React detection
      if (deps.react) {
        frameworks.push({
          name: 'React',
          version: deps.react,
          type: 'frontend',
          language: 'javascript',
          configFiles: ['package.json', 'webpack.config.js', 'vite.config.js', 'tsconfig.json'],
          patterns: [
            'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
            'Component', 'PureComponent', 'createContext', 'createElement'
          ],
          dependencies: Object.keys(deps)
        });
      }
      
      // Next.js detection
      if (deps.next) {
        frameworks.push({
          name: 'Next.js',
          version: deps.next,
          type: 'fullstack',
          language: 'javascript',
          configFiles: ['next.config.js', 'pages/', 'app/', 'public/'],
          patterns: ['getStaticProps', 'getServerSideProps', 'getStaticPaths', 'useRouter']
        });
      }
      
      // Angular detection
      if (deps['@angular/core']) {
        frameworks.push({
          name: 'Angular',
          version: deps['@angular/core'],
          type: 'frontend',
          language: 'typescript',
          configFiles: ['angular.json', 'tsconfig.json', 'angular-cli.json'],
          patterns: [
            '@Component', '@Injectable', '@NgModule', '@Directive', '@Pipe',
            'OnInit', 'OnDestroy', 'OnChanges', 'ViewChild', 'Input', 'Output'
          ],
          dependencies: Object.keys(deps)
        });
      }
      
      // Vue.js detection
      if (deps.vue) {
        frameworks.push({
          name: 'Vue.js',
          version: deps.vue,
          type: 'frontend',
          language: 'javascript',
          configFiles: ['vue.config.js', 'vite.config.js', 'nuxt.config.js'],
          patterns: ['createApp', 'ref', 'reactive', 'computed', 'watch', 'onMounted', 'defineComponent']
        });
      }
      
      // Express.js detection
      if (deps.express) {
        frameworks.push({
          name: 'Express.js',
          version: deps.express,
          type: 'backend',
          language: 'javascript',
          configFiles: ['package.json', 'app.js', 'server.js', 'index.js'],
          patterns: ['app.get', 'app.post', 'app.put', 'app.delete', 'middleware', 'req.params', 'res.json']
        });
      }
      
      // Nest.js detection
      if (deps['@nestjs/core']) {
        frameworks.push({
          name: 'NestJS',
          version: deps['@nestjs/core'],
          type: 'backend',
          language: 'typescript',
          configFiles: ['nest-cli.json', 'tsconfig.json'],
          patterns: ['@Controller', '@Injectable', '@Module', '@Get', '@Post', '@Put', '@Delete']
        });
      }
    }
    
    return frameworks;
  }

  private static async detectPythonFrameworks(rootPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    // Check requirements.txt
    const requirementsPath = path.join(rootPath, 'requirements.txt');
    if (await FileUtils.pathExists(requirementsPath)) {
      const requirementsContent = await FileUtils.readFileAsync(requirementsPath);
      
      // Flask detection
      if (requirementsContent.includes('Flask')) {
        const version = this.extractVersionFromRequirements(requirementsContent, 'Flask');
        frameworks.push({
          name: 'Flask',
          version,
          type: 'backend',
          language: 'python',
          configFiles: ['requirements.txt', 'config.py', 'app.py', 'run.py'],
          patterns: [
            'from flask import', '@app.route', 'Flask(__name__)', 'request', 'jsonify',
            'render_template', 'redirect', 'url_for', 'session', 'flash'
          ]
        });
      }
      
      // FastAPI detection
      if (requirementsContent.includes('fastapi')) {
        const version = this.extractVersionFromRequirements(requirementsContent, 'fastapi');
        frameworks.push({
          name: 'FastAPI',
          version,
          type: 'backend',
          language: 'python',
          configFiles: ['requirements.txt', 'main.py', 'app.py'],
          patterns: [
            'from fastapi import', 'FastAPI()', '@app.get', '@app.post', '@app.put', '@app.delete',
            'Depends', 'HTTPException', 'status', 'Response', 'Request'
          ]
        });
      }
      
      // Django detection
      if (requirementsContent.includes('Django')) {
        const version = this.extractVersionFromRequirements(requirementsContent, 'Django');
        frameworks.push({
          name: 'Django',
          version,
          type: 'fullstack',
          language: 'python',
          configFiles: ['manage.py', 'settings.py', 'urls.py', 'wsgi.py'],
          patterns: [
            'from django.', 'models.Model', 'views.View', 'forms.Form', 'admin.ModelAdmin',
            'HttpResponse', 'render', 'redirect', 'reverse'
          ]
        });
      }
      
      // Streamlit detection
      if (requirementsContent.includes('streamlit')) {
        const version = this.extractVersionFromRequirements(requirementsContent, 'streamlit');
        frameworks.push({
          name: 'Streamlit',
          version,
          type: 'frontend',
          language: 'python',
          configFiles: ['requirements.txt', 'streamlit_app.py', 'app.py', '.streamlit/config.toml'],
          patterns: [
            'import streamlit as st', 'st.', 'streamlit.', 'st.sidebar', 'st.write', 'st.title',
            'st.header', 'st.subheader', 'st.text', 'st.markdown', 'st.button', 'st.selectbox',
            'st.multiselect', 'st.slider', 'st.text_input', 'st.file_uploader', 'st.dataframe',
            'st.table', 'st.chart', 'st.line_chart', 'st.bar_chart', 'st.pyplot', 'st.plotly_chart'
          ]
        });
      }
    }
    
    // Check pyproject.toml
    const pyprojectPath = path.join(rootPath, 'pyproject.toml');
    if (await FileUtils.pathExists(pyprojectPath)) {
      const pyprojectContent = await FileUtils.readFileAsync(pyprojectPath);
      
      if (pyprojectContent.includes('fastapi')) {
        frameworks.push({
          name: 'FastAPI (Poetry)',
          type: 'backend',
          language: 'python',
          configFiles: ['pyproject.toml', 'main.py'],
          patterns: ['FastAPI()', '@app.get', '@app.post', 'Depends']
        });
      }
    }
    
    return frameworks;
  }

  private static extractVersionFromPom(pomContent: string, dependency: string): string | undefined {
    const versionPattern = new RegExp(`<${dependency}\\.version>(.*?)</${dependency}\\.version>`, 'i');
    const match = pomContent.match(versionPattern);
    return match ? match[1] : undefined;
  }

  private static extractVersionFromRequirements(content: string, packageName: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith(packageName.toLowerCase())) {
        const versionMatch = line.match(/==([0-9.]+)/);
        return versionMatch ? versionMatch[1] : undefined;
      }
    }
    return undefined;
  }

  private static extractDependenciesFromPom(pomContent: string): string[] {
    const dependencies: string[] = [];
    const dependencyPattern = /<artifactId>(.*?)<\/artifactId>/g;
    let match;
    
    while ((match = dependencyPattern.exec(pomContent)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  static getFrameworkSpecificPatterns(framework: string): string[] {
    const patterns: Record<string, string[]> = {
      'spring-boot': [
        '@SpringBootApplication', '@RestController', '@Controller', '@Service', '@Repository',
        '@Component', '@Configuration', '@Entity', '@Autowired', '@Value', '@PostMapping',
        '@GetMapping', '@PutMapping', '@DeleteMapping', '@RequestMapping', '@PathVariable',
        '@RequestParam', '@RequestBody', '@ResponseBody', '@CrossOrigin', '@Transactional'
      ],
      'spring': [
        '@Component', '@Service', '@Repository', '@Controller', '@Autowired', '@Qualifier',
        '@Value', '@Configuration', '@Bean', '@Scope', '@Lazy', '@Primary', '@Profile'
      ],
      'react': [
        'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
        'useRef', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue', 'Component',
        'PureComponent', 'createContext', 'createElement', 'cloneElement', 'Fragment'
      ],
      'angular': [
        '@Component', '@Injectable', '@NgModule', '@Directive', '@Pipe', '@Input', '@Output',
        '@ViewChild', '@ViewChildren', '@ContentChild', '@ContentChildren', '@HostListener',
        '@HostBinding', 'OnInit', 'OnDestroy', 'OnChanges', 'DoCheck', 'AfterContentInit'
      ],
      'flask': [
        'from flask import', '@app.route', 'Flask(__name__)', 'request', 'jsonify', 'render_template',
        'redirect', 'url_for', 'session', 'flash', 'abort', 'make_response', 'Blueprint',
        'current_app', 'g', 'before_request', 'after_request', 'teardown_request'
      ],
      'fastapi': [
        'from fastapi import', 'FastAPI()', '@app.get', '@app.post', '@app.put', '@app.delete',
        '@app.patch', 'Depends', 'HTTPException', 'status', 'Response', 'Request', 'Form',
        'File', 'UploadFile', 'BackgroundTasks', 'Security', 'OAuth2PasswordBearer'
      ],
      'streamlit': [
        'import streamlit as st', 'st.', 'streamlit.', 'st.sidebar', 'st.write', 'st.title',
        'st.header', 'st.subheader', 'st.text', 'st.markdown', 'st.button', 'st.selectbox',
        'st.multiselect', 'st.slider', 'st.text_input', 'st.file_uploader', 'st.dataframe',
        'st.table', 'st.chart', 'st.line_chart', 'st.bar_chart', 'st.pyplot', 'st.plotly_chart',
        'st.session_state', 'st.cache', 'st.experimental_memo', 'st.experimental_singleton'
      ]
    };
    
    return patterns[framework.toLowerCase()] || [];
  }
}