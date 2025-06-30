import re
from textblob import TextBlob
import spacy
from typing import Dict, List, Tuple
import numpy as np
from datetime import datetime

class ScoringService:
    def __init__(self):
        """Initialize the Scoring Service with NLP models"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            import os
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")
        
        # Behavioral indicators and keywords
        self.behavioral_indicators = {
            'leadership': {
                'keywords': ['led', 'managed', 'supervised', 'coordinated', 'organized', 'initiated', 'directed'],
                'weight': 1.2
            },
            'communication': {
                'keywords': ['presented', 'explained', 'communicated', 'conveyed', 'articulated', 'demonstrated'],
                'weight': 1.1
            },
            'problem_solving': {
                'keywords': ['solved', 'resolved', 'analyzed', 'investigated', 'troubleshoot', 'debugged', 'optimized'],
                'weight': 1.3
            },
            'teamwork': {
                'keywords': ['collaborated', 'worked with', 'team', 'partnered', 'cooperated', 'supported'],
                'weight': 1.0
            },
            'adaptability': {
                'keywords': ['adapted', 'learned', 'flexible', 'changed', 'evolved', 'improved', 'enhanced'],
                'weight': 1.1
            },
            'achievement': {
                'keywords': ['achieved', 'increased', 'improved', 'reduced', 'delivered', 'completed', 'successful'],
                'weight': 1.4
            }
        }
        
        # Negative indicators
        self.negative_indicators = {
            'blame': ['blamed', 'fault', 'problem with', 'issue with', 'they made me'],
            'vague': ['kind of', 'sort of', 'maybe', 'probably', 'I think', 'I guess'],
            'negative': ['failed', 'couldn\'t', 'didn\'t work', 'problem', 'issue', 'difficult']
        }
    
    def analyze_transcript(self, transcript: str) -> Dict:
        """
        Analyze interview transcript and calculate behavior score with detailed breakdown
        
        Args:
            transcript (str): Interview transcript text
            
        Returns:
            Dict: Comprehensive analysis with scores, breakdowns, and explanations
        """
        if not transcript or len(transcript.strip()) < 50:
            return {
                'overall_score': 0.0,
                'score_breakdown': {
                    'sentiment_score': 0.0,
                    'communication_score': 0.0,
                    'behavioral_score': 0.0,
                    'response_quality_score': 0.0
                },
                'weights_used': {
                    'sentiment': 0.25,
                    'communication': 0.30,
                    'behavioral': 0.35,
                    'quality': 0.10
                },
                'reason_for_low_score': 'Insufficient transcript content for analysis',
                'confidence_level': 'low',
                'analysis_method': 'fallback'
            }
        
        try:
            # Clean transcript
            clean_transcript = self._clean_transcript(transcript)
            
            # Calculate various scores with detailed breakdowns
            sentiment_analysis = self._calculate_sentiment_score_detailed(clean_transcript)
            communication_analysis = self._calculate_communication_score_detailed(clean_transcript)
            behavioral_analysis = self._calculate_behavioral_indicators_detailed(clean_transcript)
            quality_analysis = self._calculate_response_quality_detailed(clean_transcript)
            
            # Calculate weighted final score
            weights = {
                'sentiment': 0.25,
                'communication': 0.30,
                'behavioral': 0.35,
                'quality': 0.10
            }
            
            final_score = (
                sentiment_analysis['score'] * weights['sentiment'] +
                communication_analysis['score'] * weights['communication'] +
                behavioral_analysis['score'] * weights['behavioral'] +
                quality_analysis['score'] * weights['quality']
            )
            
            # Determine confidence level
            confidence_level = self._determine_confidence_level(
                sentiment_analysis, communication_analysis, behavioral_analysis, quality_analysis
            )
            
            # Identify reasons for low score
            low_score_reasons = self._identify_low_score_reasons(
                sentiment_analysis, communication_analysis, behavioral_analysis, quality_analysis
            )
            
            return {
                'overall_score': round(max(0, min(100, final_score)), 2),
                'score_breakdown': {
                    'sentiment_score': sentiment_analysis['score'],
                    'communication_score': communication_analysis['score'],
                    'behavioral_score': behavioral_analysis['score'],
                    'response_quality_score': quality_analysis['score']
                },
                'weights_used': weights,
                'detailed_analysis': {
                    'sentiment': sentiment_analysis,
                    'communication': communication_analysis,
                    'behavioral': behavioral_analysis,
                    'quality': quality_analysis
                },
                'confidence_level': confidence_level,
                'reason_for_low_score': low_score_reasons,
                'analysis_method': 'comprehensive',
                'transcript_length': len(clean_transcript),
                'analysis_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error analyzing transcript: {str(e)}")
            return {
                'overall_score': 50.0,
                'score_breakdown': {
                    'sentiment_score': 50.0,
                    'communication_score': 50.0,
                    'behavioral_score': 50.0,
                    'response_quality_score': 50.0
                },
                'weights_used': {
                    'sentiment': 0.25,
                    'communication': 0.30,
                    'behavioral': 0.35,
                    'quality': 0.10
                },
                'reason_for_low_score': f'Analysis error: {str(e)}',
                'confidence_level': 'low',
                'analysis_method': 'error_fallback'
            }
    
    def get_analysis_breakdown(self, transcript: str) -> Dict:
        """
        Get detailed breakdown of transcript analysis
        
        Args:
            transcript (str): Interview transcript text
            
        Returns:
            Dict: Detailed analysis breakdown
        """
        clean_transcript = self._clean_transcript(transcript)
        
        return {
            'sentiment_analysis': self._get_sentiment_breakdown(clean_transcript),
            'communication_metrics': self._get_communication_metrics(clean_transcript),
            'behavioral_indicators': self._get_behavioral_breakdown(clean_transcript),
            'response_quality': self._get_response_quality_breakdown(clean_transcript),
            'key_phrases': self._extract_key_phrases(clean_transcript),
            'improvement_areas': self._identify_improvement_areas(clean_transcript),
            'strength_indicators': self._identify_strength_indicators(clean_transcript)
        }
    
    def _calculate_sentiment_score_detailed(self, text: str) -> Dict:
        """Calculate detailed sentiment score with explanations"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Convert polarity (-1 to 1) to score (0 to 100)
            sentiment_score = (polarity + 1) * 50
            
            # Determine sentiment category
            if polarity > 0.3:
                sentiment_category = 'positive'
                explanation = 'Candidate shows positive attitude and enthusiasm'
            elif polarity > -0.1:
                sentiment_category = 'neutral'
                explanation = 'Candidate maintains neutral tone throughout'
            else:
                sentiment_category = 'negative'
                explanation = 'Candidate shows negative or defensive attitude'
            
            return {
                'score': max(0, min(100, sentiment_score)),
                'polarity': round(polarity, 3),
                'subjectivity': round(subjectivity, 3),
                'category': sentiment_category,
                'explanation': explanation,
                'confidence': round(abs(polarity), 3)
            }
            
        except Exception as e:
            return {
                'score': 50.0,
                'polarity': 0.0,
                'subjectivity': 0.0,
                'category': 'neutral',
                'explanation': f'Sentiment analysis failed: {str(e)}',
                'confidence': 0.0
            }
    
    def _calculate_communication_score_detailed(self, text: str) -> Dict:
        """Calculate detailed communication score with breakdown"""
        try:
            doc = self.nlp(text)
            
            # Calculate metrics
            word_count = len(doc)
            sentence_count = len(list(doc.sents))
            avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
            
            # Vocabulary diversity
            unique_words = len(set([token.text.lower() for token in doc if not token.is_punct]))
            vocabulary_diversity = unique_words / word_count if word_count > 0 else 0
            
            # Clarity indicators
            clarity_indicators = [
                'specifically', 'for example', 'in other words', 'to clarify',
                'as a result', 'therefore', 'consequently', 'in conclusion'
            ]
            clarity_count = sum(1 for indicator in clarity_indicators if indicator in text.lower())
            
            # Score calculation with explanations
            length_score = min(100, word_count / 2)
            clarity_score = min(100, clarity_count * 20)
            diversity_score = min(100, vocabulary_diversity * 200)
            
            # Penalties and bonuses
            if word_count < 50:
                length_score *= 0.5
                length_explanation = 'Response too brief for comprehensive analysis'
            elif word_count > 500:
                length_score *= 0.8
                length_explanation = 'Response very detailed but may be verbose'
            else:
                length_explanation = 'Response length appropriate'
            
            communication_score = (length_score * 0.4 + clarity_score * 0.3 + diversity_score * 0.3)
            
            return {
                'score': max(0, min(100, communication_score)),
                'metrics': {
                    'word_count': word_count,
                    'sentence_count': sentence_count,
                    'avg_sentence_length': round(avg_sentence_length, 2),
                    'vocabulary_diversity': round(vocabulary_diversity, 3),
                    'clarity_indicators': clarity_count
                },
                'subscores': {
                    'length_score': round(length_score, 2),
                    'clarity_score': round(clarity_score, 2),
                    'diversity_score': round(diversity_score, 2)
                },
                'explanations': {
                    'length': length_explanation,
                    'clarity': f'Used {clarity_count} clarity indicators',
                    'diversity': f'Vocabulary diversity: {round(vocabulary_diversity * 100, 1)}%'
                }
            }
            
        except Exception as e:
            return {
                'score': 50.0,
                'metrics': {},
                'subscores': {},
                'explanations': {'error': f'Communication analysis failed: {str(e)}'}
            }
    
    def _calculate_behavioral_indicators_detailed(self, text: str) -> Dict:
        """Calculate detailed behavioral indicators score"""
        try:
            text_lower = text.lower()
            category_scores = {}
            total_weighted_score = 0
            total_weight = 0
            
            for category, config in self.behavioral_indicators.items():
                keywords = config['keywords']
                weight = config['weight']
                
                # Count keyword occurrences
                keyword_count = sum(1 for keyword in keywords if keyword in text_lower)
                
                # Calculate category score
                category_score = min(100, keyword_count * 15)
                
                category_scores[category] = {
                    'score': category_score,
                    'keyword_count': keyword_count,
                    'weight': weight,
                    'keywords_found': [kw for kw in keywords if kw in text_lower],
                    'explanation': f'Found {keyword_count} instances of {category} indicators'
                }
                
                total_weighted_score += category_score * weight
                total_weight += weight
            
            behavioral_score = total_weighted_score / total_weight if total_weight > 0 else 0
            
            return {
                'score': max(0, min(100, behavioral_score)),
                'category_breakdown': category_scores,
                'total_indicators_found': sum(cat['keyword_count'] for cat in category_scores.values()),
                'strongest_category': max(category_scores.items(), key=lambda x: x[1]['score'])[0] if category_scores else 'none',
                'weakest_category': min(category_scores.items(), key=lambda x: x[1]['score'])[0] if category_scores else 'none'
            }
            
        except Exception as e:
            return {
                'score': 50.0,
                'category_breakdown': {},
                'total_indicators_found': 0,
                'strongest_category': 'none',
                'weakest_category': 'none',
                'error': str(e)
            }
    
    def _calculate_response_quality_detailed(self, text: str) -> Dict:
        """Calculate detailed response quality score"""
        try:
            text_lower = text.lower()
            
            # Check for negative indicators
            negative_penalties = {}
            total_penalty = 0
            
            for category, indicators in self.negative_indicators.items():
                category_penalty = 0
                found_indicators = []
                
                for indicator in indicators:
                    if indicator in text_lower:
                        category_penalty += 10
                        found_indicators.append(indicator)
                
                negative_penalties[category] = {
                    'penalty': category_penalty,
                    'indicators_found': found_indicators
                }
                total_penalty += category_penalty
            
            # Base quality score
            quality_score = 70
            
            # Apply penalties
            quality_score -= total_penalty
            
            # Rewards for positive indicators
            rewards = {}
            
            # Specific examples
            if re.search(r'\d+%|\d+ percent|\d+ people|\d+ team', text_lower):
                quality_score += 15
                rewards['metrics'] = 'Included specific metrics and numbers'
            
            if re.search(r'for example|specifically|in one instance', text_lower):
                quality_score += 10
                rewards['examples'] = 'Provided specific examples'
            
            if re.search(r'because|since|as a result|therefore', text_lower):
                quality_score += 5
                rewards['reasoning'] = 'Showed logical reasoning'
            
            return {
                'score': max(0, min(100, quality_score)),
                'base_score': 70,
                'penalties': negative_penalties,
                'total_penalty': total_penalty,
                'rewards': rewards,
                'total_rewards': sum(rewards.values()) if isinstance(rewards, dict) else 0,
                'explanation': f'Base score 70, penalties -{total_penalty}, rewards +{sum(rewards.values()) if isinstance(rewards, dict) else 0}'
            }
            
        except Exception as e:
            return {
                'score': 50.0,
                'base_score': 70,
                'penalties': {},
                'total_penalty': 0,
                'rewards': {},
                'total_rewards': 0,
                'explanation': f'Quality analysis failed: {str(e)}'
            }
    
    def _determine_confidence_level(self, sentiment_analysis: Dict, communication_analysis: Dict, 
                                  behavioral_analysis: Dict, quality_analysis: Dict) -> str:
        """Determine confidence level based on analysis quality"""
        confidence_factors = []
        
        # Check if all analyses completed successfully
        if all('error' not in analysis for analysis in [sentiment_analysis, communication_analysis, behavioral_analysis, quality_analysis]):
            confidence_factors.append('all_analyses_completed')
        
        # Check transcript length
        if communication_analysis.get('metrics', {}).get('word_count', 0) > 100:
            confidence_factors.append('sufficient_length')
        
        # Check for specific examples
        if quality_analysis.get('rewards', {}).get('examples'):
            confidence_factors.append('specific_examples')
        
        # Check sentiment confidence
        if sentiment_analysis.get('confidence', 0) > 0.3:
            confidence_factors.append('clear_sentiment')
        
        if len(confidence_factors) >= 3:
            return 'high'
        elif len(confidence_factors) >= 2:
            return 'medium'
        else:
            return 'low'
    
    def _identify_low_score_reasons(self, sentiment_analysis: Dict, communication_analysis: Dict, 
                                  behavioral_analysis: Dict, quality_analysis: Dict) -> List[str]:
        """Identify specific reasons for low scores"""
        reasons = []
        
        # Check sentiment
        if sentiment_analysis.get('score', 50) < 40:
            reasons.append(f"Low sentiment score ({sentiment_analysis.get('score', 0)}): {sentiment_analysis.get('explanation', '')}")
        
        # Check communication
        if communication_analysis.get('score', 50) < 40:
            reasons.append(f"Poor communication ({communication_analysis.get('score', 0)}): {communication_analysis.get('explanations', {}).get('length', '')}")
        
        # Check behavioral indicators
        if behavioral_analysis.get('score', 50) < 40:
            reasons.append(f"Few behavioral indicators ({behavioral_analysis.get('total_indicators_found', 0)} found)")
        
        # Check quality
        if quality_analysis.get('score', 50) < 40:
            reasons.append(f"Response quality issues: {quality_analysis.get('explanation', '')}")
        
        return reasons if reasons else ["Score analysis completed successfully"]
    
    def _identify_strength_indicators(self, text: str) -> List[str]:
        """Identify positive strength indicators in the transcript"""
        strengths = []
        text_lower = text.lower()
        
        # Check for achievement language
        if re.search(r'achieved|increased|improved|reduced|delivered|completed', text_lower):
            strengths.append("Demonstrated achievement orientation")
        
        # Check for specific metrics
        if re.search(r'\d+%|\d+ percent|\d+ people|\d+ team', text_lower):
            strengths.append("Provided quantifiable results")
        
        # Check for leadership indicators
        if re.search(r'led|managed|supervised|coordinated', text_lower):
            strengths.append("Showed leadership experience")
        
        # Check for problem-solving
        if re.search(r'solved|resolved|analyzed|investigated', text_lower):
            strengths.append("Demonstrated problem-solving skills")
        
        # Check for teamwork
        if re.search(r'collaborated|worked with|team|partnered', text_lower):
            strengths.append("Emphasized teamwork and collaboration")
        
        return strengths
    
    def _clean_transcript(self, transcript: str) -> str:
        """Clean and normalize transcript text"""
        # Remove interviewer text (usually starts with "Interviewer:")
        lines = transcript.split('\n')
        candidate_lines = []
        
        for line in lines:
            line = line.strip()
            if line and not line.lower().startswith('interviewer:'):
                candidate_lines.append(line)
        
        # Join candidate responses
        clean_text = ' '.join(candidate_lines)
        
        # Remove extra whitespace and normalize
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        return clean_text.strip()
    
    def _get_sentiment_breakdown(self, text: str) -> Dict:
        """Get detailed sentiment analysis"""
        try:
            blob = TextBlob(text)
            
            return {
                'polarity': round(blob.sentiment.polarity, 3),
                'subjectivity': round(blob.sentiment.subjectivity, 3),
                'sentiment_label': self._get_sentiment_label(blob.sentiment.polarity),
                'confidence': round(abs(blob.sentiment.polarity), 3)
            }
        except Exception as e:
            return {
                'polarity': 0,
                'subjectivity': 0,
                'sentiment_label': 'neutral',
                'confidence': 0
            }
    
    def _get_communication_metrics(self, text: str) -> Dict:
        """Get communication metrics"""
        try:
            doc = self.nlp(text)
            
            return {
                'word_count': len(doc),
                'sentence_count': len(list(doc.sents)),
                'avg_sentence_length': round(len(doc) / len(list(doc.sents)), 2) if len(list(doc.sents)) > 0 else 0,
                'vocabulary_diversity': round(len(set([token.text.lower() for token in doc if not token.is_punct])) / len(doc), 3) if len(doc) > 0 else 0,
                'communication_style': self._assess_communication_style(text)
            }
        except Exception as e:
            return {
                'word_count': 0,
                'sentence_count': 0,
                'avg_sentence_length': 0,
                'vocabulary_diversity': 0,
                'communication_style': 'neutral'
            }
    
    def _get_behavioral_breakdown(self, text: str) -> Dict:
        """Get behavioral indicators breakdown"""
        text_lower = text.lower()
        breakdown = {}
        
        for category, config in self.behavioral_indicators.items():
            keywords = config['keywords']
            keyword_count = sum(1 for keyword in keywords if keyword in text_lower)
            breakdown[category] = {
                'count': keyword_count,
                'score': min(100, keyword_count * 15),
                'weight': config['weight']
            }
        
        return breakdown
    
    def _get_response_quality_breakdown(self, text: str) -> Dict:
        """Get response quality breakdown"""
        text_lower = text.lower()
        
        # Check for specific examples
        has_examples = bool(re.search(r'for example|specifically|in one instance', text_lower))
        
        # Check for metrics
        has_metrics = bool(re.search(r'\d+%|\d+ percent|\d+ people|\d+ team', text_lower))
        
        # Check for negative indicators
        negative_count = sum(1 for category in self.negative_indicators.values() 
                           for indicator in category if indicator in text_lower)
        
        return {
            'has_specific_examples': has_examples,
            'has_metrics': has_metrics,
            'negative_indicators_count': negative_count,
            'overall_quality': 'good' if has_examples and has_metrics and negative_count == 0 else 'needs_improvement'
        }
    
    def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases from transcript"""
        try:
            doc = self.nlp(text)
            
            # Extract noun phrases and important sentences
            key_phrases = []
            
            # Get noun phrases
            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) >= 2:  # At least 2 words
                    key_phrases.append(chunk.text)
            
            # Get sentences with behavioral keywords
            for sent in doc.sents:
                sent_text = sent.text.lower()
                if any(keyword in sent_text for category in self.behavioral_indicators.values() 
                      for keyword in category['keywords']):
                    key_phrases.append(sent.text.strip())
            
            return key_phrases[:5]  # Return top 5 key phrases
            
        except Exception as e:
            return []
    
    def _identify_improvement_areas(self, text: str) -> List[str]:
        """Identify areas for improvement"""
        improvement_areas = []
        text_lower = text.lower()
        
        # Check for vague language
        vague_indicators = self.negative_indicators['vague']
        if any(indicator in text_lower for indicator in vague_indicators):
            improvement_areas.append("Use more specific language instead of vague terms")
        
        # Check for lack of examples
        if not re.search(r'for example|specifically|in one instance', text_lower):
            improvement_areas.append("Provide specific examples to support your statements")
        
        # Check for lack of metrics
        if not re.search(r'\d+%|\d+ percent|\d+ people|\d+ team', text_lower):
            improvement_areas.append("Include quantifiable achievements and metrics")
        
        # Check for negative language
        negative_indicators = self.negative_indicators['negative']
        if any(indicator in text_lower for indicator in negative_indicators):
            improvement_areas.append("Focus on positive outcomes and solutions")
        
        return improvement_areas
    
    def _get_sentiment_label(self, polarity: float) -> str:
        """Get sentiment label based on polarity"""
        if polarity > 0.1:
            return 'positive'
        elif polarity < -0.1:
            return 'negative'
        else:
            return 'neutral'
    
    def _assess_communication_style(self, text: str) -> str:
        """Assess communication style"""
        doc = self.nlp(text)
        
        # Calculate various style indicators
        avg_sentence_length = len(doc) / len(list(doc.sents)) if len(list(doc.sents)) > 0 else 0
        
        if avg_sentence_length > 20:
            return 'detailed'
        elif avg_sentence_length > 10:
            return 'balanced'
        else:
            return 'concise' 