// api/requirement-analyzer/validate.ts
// AI 分析结果验证工具

import type { 
  ParsedRequirement, 
  AIAnalysisResult, 
  AIRepoDetectionResult,
  AIRepositoryMatch 
} from './index';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    summaryValid: boolean;
    featuresFormatValid: boolean;
    confidenceValid: boolean;
    reposExist: boolean;
  };
}

/**
 * 验证 AI 需求分析结果
 */
export function validateAIRequirementResult(result: ParsedRequirement & {
  aiRepos: AIRepoDetectionResult;
  aiAnalysis: string;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. 验证摘要
  const summaryValid = validateSummary(result.summary);
  if (!summaryValid.valid) {
    errors.push(`摘要格式错误: ${summaryValid.message}`);
  }
  
  // 2. 验证功能点
  const featuresValid = validateFeatures(result.keyFeatures);
  if (!featuresValid.valid) {
    errors.push(`功能点格式错误: ${featuresValid.message}`);
  }
  
  // 3. 验证置信度
  const confidenceValid = validateConfidence(result.aiRepos);
  if (!confidenceValid.valid) {
    errors.push(`置信度错误: ${confidenceValid.message}`);
  }
  
  // 4. 验证仓库存在性
  const reposExist = result.aiRepos.primaryRepos.length > 0 || result.aiRepos.secondaryRepos.length > 0;
  if (!reposExist) {
    warnings.push('未识别到任何仓库，可能需要手动选择');
  }
  
  // 5. 验证 AI 分析说明
  if (!result.aiAnalysis || result.aiAnalysis.length < 10) {
    warnings.push('AI 分析说明过短，可能影响理解');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      summaryValid: summaryValid.valid,
      featuresFormatValid: featuresValid.valid,
      confidenceValid: confidenceValid.valid,
      reposExist
    }
  };
}

/**
 * 验证摘要格式
 */
function validateSummary(summary: string): { valid: boolean; message?: string } {
  // 必填
  if (!summary || summary.trim().length === 0) {
    return { valid: false, message: '摘要不能为空' };
  }
  
  // 长度检查
  if (summary.length < 5) {
    return { valid: false, message: `摘要过短（${summary.length}字），至少5字` };
  }
  if (summary.length > 30) {
    return { valid: false, message: `摘要过长（${summary.length}字），最多30字` };
  }
  
  // 格式检查：动作:目标
  if (!summary.includes(':')) {
    return { valid: false, message: '摘要格式应为"动作:目标"' };
  }
  
  // 过滤元信息
  const metaPatterns = ['（独立项）', '（开发者设计）', '（）'];
  for (const pattern of metaPatterns) {
    if (summary.includes(pattern)) {
      return { valid: false, message: `摘要包含元信息"${pattern}"` };
    }
  }
  
  return { valid: true };
}

/**
 * 验证功能点格式
 */
function validateFeatures(features: string[]): { valid: boolean; message?: string } {
  // 必须有功能点
  if (!Array.isArray(features) || features.length === 0) {
    return { valid: false, message: '至少需要一个功能点' };
  }
  
  // 最多5个功能点
  if (features.length > 5) {
    return { valid: false, message: `功能点过多（${features.length}个），最多5个` };
  }
  
  // 每个功能点格式检查
  for (const feature of features) {
    // 必填
    if (!feature || feature.trim().length === 0) {
      return { valid: false, message: '功能点不能为空' };
    }
    
    // 长度
    if (feature.length < 3) {
      return { valid: false, message: `功能点"${feature}"过短，至少3字` };
    }
    if (feature.length > 15) {
      return { valid: false, message: `功能点"${feature}"过长，最多15字` };
    }
    
    // 动词+名词格式（以中文开头）
    if (!/^([\u4e00-\u9fa5])+/.test(feature)) {
      return { valid: false, message: `功能点"${feature}"应以中文开头` };
    }
    
    // 过滤元信息
    const metaPatterns = ['独立项', '开发者设计', '需求分析', '业务分析', '解决方案'];
    for (const pattern of metaPatterns) {
      if (feature.includes(pattern)) {
        return { valid: false, message: `功能点"${feature}"包含元信息"${pattern}"` };
      }
    }
  }
  
  return { valid: true };
}

/**
 * 验证置信度
 */
function validateConfidence(repos: AIRepoDetectionResult): { valid: boolean; message?: string } {
  // 主要仓库置信度检查
  for (const repo of repos.primaryRepos) {
    if (repo.aiConfidence < 0.8) {
      return { 
        valid: false, 
        message: `主要仓库"${repo.name}"置信度${repo.aiConfidence}低于阈值0.8` 
      };
    }
    if (repo.aiConfidence > 1) {
      return { valid: false, message: `置信度${repo.aiConfidence}不能大于1` };
    }
  }
  
  // 次要仓库置信度可以略低（>= 0.6）
  for (const repo of repos.secondaryRepos) {
    if (repo.aiConfidence < 0.6) {
      return { 
        valid: false, 
        message: `次要仓库"${repo.name}"置信度${repo.aiConfidence}低于阈值0.6` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * 打印验证报告
 */
export function printValidationResult(result: ValidationResult, title: string = '验证结果') {
  console.log(`\n========== ${title} ==========`);
  console.log(`状态: ${result.valid ? '✅ 通过' : '❌ 失败'}`);
  
  if (result.errors.length > 0) {
    console.log('\n错误:');
    result.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\n警告:');
    result.warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
  }
  
  console.log('\n详情:');
  console.log(`  - 摘要格式: ${result.details.summaryValid ? '✅' : '❌'}`);
  console.log(`  - 功能点格式: ${result.details.featuresFormatValid ? '✅' : '❌'}`);
  console.log(`  - 置信度: ${result.details.confidenceValid ? '✅' : '❌'}`);
  console.log(`  - 仓库存在性: ${result.details.reposExist ? '✅' : '❌'}`);
  
  console.log('================================\n');
  
  return result.valid;
}

/**
 * 批量验证多个结果
 */
export function validateBatch(results: Array<ParsedRequirement & {
  aiRepos: AIRepoDetectionResult;
  aiAnalysis: string;
}>): {
  total: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
} {
  const validationResults = results.map(result => validateAIRequirementResult(result));
  
  return {
    total: validationResults.length,
    passed: validationResults.filter(r => r.valid).length,
    failed: validationResults.filter(r => !r.valid).length,
    results: validationResults
  };
}

export default {
  validateAIRequirementResult,
  printValidationResult,
  validateBatch
};
