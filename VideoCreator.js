import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Linking,
    Alert,
    ScrollView
} from 'react-native';

// API Configuration - Update this with your server URL
const API_BASE_URL = 'http://localhost:3000';

const VideoCreator = () => {
    // Core State
    const [topic, setTopic] = useState('');
    const [hook, setHook] = useState('');
    const [fact, setFact] = useState('');

    // Options State
    const [genre, setGenre] = useState('informative');
    const [language, setLanguage] = useState('gujarati');
    const [comedyLevel, setComedyLevel] = useState('mild');

    // System State
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    // Configuration Options
    const GENRES = [
        { id: 'informative', label: 'Informative' },
        { id: 'comedy', label: 'Comedy' },
        { id: 'storytelling', label: 'Storytelling' },
        { id: 'motivational', label: 'Motivational' },
        { id: 'didyouknow', label: 'Did You Know?' }
    ];

    const LANGUAGES = [
        { id: 'gujarati', label: 'Gujarati' },
        { id: 'hindi', label: 'Hindi' },
        { id: 'english', label: 'English' }
    ];

    const COMEDY_LEVELS = [
        { id: 'mild', label: 'Mild' },
        { id: 'medium', label: 'Medium' },
        { id: 'spicy', label: 'Spicy' }
    ];

    const createVideo = async () => {
        // Validation
        if (genre === 'didyouknow') {
            if (!hook.trim() || !fact.trim()) {
                Alert.alert('Error', 'Please enter both Hook and Fact');
                return;
            }
        } else {
            if (!topic.trim()) {
                Alert.alert('Error', 'Please enter a topic for your video');
                return;
            }
        }

        setIsLoading(true);
        setStatusMessage('Initializing video creation...');
        setVideoUrl(null);
        setError(null);

        try {
            setStatusMessage(`Generating ${genre} video in ${language}...`);

            const payload = {
                genre,
                language,
                // Include comedy level only if relevant, but safe to send always
                comedyLevel: genre === 'comedy' ? comedyLevel : 'mild',
            };

            if (genre === 'didyouknow') {
                payload.hook = hook.trim();
                payload.fact = fact.trim();
            } else {
                payload.topic = topic.trim();
            }

            const response = await fetch(`${API_BASE_URL}/api/create-video`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create video');
            }

            if (data.success && data.videoUrl) {
                setVideoUrl(data.videoUrl);
                setStatusMessage(`Video created successfully with ${data.scenesCount} scenes!`);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err) {
            console.error('Video creation error:', err);
            setError(err.message || 'An error occurred while creating the video');
            setStatusMessage('');
        } finally {
            setIsLoading(false);
        }
    };

    const openVideo = async () => {
        if (!videoUrl) return;

        try {
            const supported = await Linking.canOpenURL(videoUrl);
            if (supported) {
                await Linking.openURL(videoUrl);
            } else {
                Alert.alert('Error', 'Cannot open this URL');
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to open video URL');
        }
    };

    const resetForm = () => {
        setTopic('');
        setHook('');
        setFact('');
        setVideoUrl(null);
        setError(null);
        setStatusMessage('');
    };

    // Helper to render selection chips
    const renderChips = (options, selectedValue, onSelect) => (
        <View style={styles.chipContainer}>
            {options.map((option) => (
                <TouchableOpacity
                    key={option.id}
                    style={[
                        styles.chip,
                        selectedValue === option.id && styles.chipActive
                    ]}
                    onPress={() => onSelect(option.id)}
                    disabled={isLoading}
                >
                    <Text style={[
                        styles.chipText,
                        selectedValue === option.id && styles.chipTextActive
                    ]}>
                        {option.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>AI Video Creator</Text>
                <Text style={styles.subtitle}>
                    Generate professional videos from any topic using AI
                </Text>
            </View>

            {/* Language Selection */}
            <View style={styles.section}>
                <Text style={styles.label}>Language</Text>
                {renderChips(LANGUAGES, language, setLanguage)}
            </View>

            {/* Genre Selection */}
            <View style={styles.section}>
                <Text style={styles.label}>Video Style</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {renderChips(GENRES, genre, setGenre)}
                </ScrollView>
            </View>

            {/* Comedy Level Selection (Conditional) */}
            {genre === 'comedy' && (
                <View style={styles.section}>
                    <Text style={styles.label}>Comedy Spice Level 🌶️</Text>
                    {renderChips(COMEDY_LEVELS, comedyLevel, setComedyLevel)}
                </View>
            )}

            {/* Input Section */}
            <View style={styles.inputSection}>
                {genre === 'didyouknow' ? (
                    <>
                        <Text style={styles.label}>The Hook (Grab Attention)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g., Did you know honey never spoils?"
                            placeholderTextColor="#888"
                            value={hook}
                            onChangeText={setHook}
                            multiline
                            numberOfLines={2}
                            editable={!isLoading}
                        />
                        <Text style={[styles.label, { marginTop: 15 }]}>The Fact (Reveal)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g., Archaeologists found 3000 year old honey..."
                            placeholderTextColor="#888"
                            value={fact}
                            onChangeText={setFact}
                            multiline
                            numberOfLines={3}
                            editable={!isLoading}
                        />
                    </>
                ) : (
                    <>
                        <Text style={styles.label}>Enter Your Topic</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g., The History of Ancient Egypt"
                            placeholderTextColor="#888"
                            value={topic}
                            onChangeText={setTopic}
                            multiline
                            numberOfLines={3}
                            editable={!isLoading}
                        />
                    </>
                )}
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={createVideo}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Text style={styles.buttonText}>Create Video</Text>
                )}
            </TouchableOpacity>

            {/* Status Section */}
            {isLoading && (
                <View style={styles.statusSection}>
                    <ActivityIndicator color="#6366f1" size="large" />
                    <Text style={styles.statusText}>{statusMessage}</Text>
                    <Text style={styles.statusSubtext}>
                        Please wait while we generate your video...
                    </Text>
                </View>
            )}

            {/* Error Display */}
            {error && (
                <View style={styles.errorSection}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={resetForm}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Success Section */}
            {videoUrl && !isLoading && (
                <View style={styles.successSection}>
                    <Text style={styles.successTitle}>🎉 Video Ready!</Text>
                    <Text style={styles.successText}>{statusMessage}</Text>

                    <TouchableOpacity style={styles.videoButton} onPress={openVideo}>
                        <Text style={styles.videoButtonText}>Open Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.newVideoButton} onPress={resetForm}>
                        <Text style={styles.newVideoButtonText}>Create New Video</Text>
                    </TouchableOpacity>

                    <View style={styles.urlContainer}>
                        <Text style={styles.urlLabel}>Video URL:</Text>
                        <Text style={styles.urlText} selectable>
                            {videoUrl}
                        </Text>
                    </View>
                </View>
            )}

            {/* Info Section */}
            <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>How it works:</Text>
                <Text style={styles.infoText}>
                    1. Select your preferred Language and Style
                </Text>
                <Text style={styles.infoText}>
                    2. Enter your topic or hook/fact
                </Text>
                <Text style={styles.infoText}>
                    3. AI generates script, voice, and images
                </Text>
                <Text style={styles.infoText}>
                    4. {genre === 'didyouknow' ? 'Includes "Subscribe" CTA at the end!' : 'Video is ready for download!'}
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f1a',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 60,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#9ca3af',
        lineHeight: 24,
    },
    section: {
        marginBottom: 20,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        backgroundColor: '#1f1f2e',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#374151',
    },
    chipActive: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    chipText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#fff',
    },
    inputSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e5e7eb',
        marginBottom: 10,
    },
    textInput: {
        backgroundColor: '#1f1f2e',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#374151',
    },
    button: {
        backgroundColor: '#6366f1',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonDisabled: {
        backgroundColor: '#4b5563',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    statusSection: {
        backgroundColor: '#1f1f2e',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    statusText: {
        fontSize: 16,
        color: '#e5e7eb',
        marginTop: 16,
        textAlign: 'center',
    },
    statusSubtext: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 8,
        textAlign: 'center',
    },
    errorSection: {
        backgroundColor: '#2d1f1f',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ef4444',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#fca5a5',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#ef4444',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    successSection: {
        backgroundColor: '#1f2d1f',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#22c55e',
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#22c55e',
        marginBottom: 8,
        textAlign: 'center',
    },
    successText: {
        fontSize: 14,
        color: '#86efac',
        marginBottom: 20,
        textAlign: 'center',
    },
    videoButton: {
        backgroundColor: '#22c55e',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    videoButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    newVideoButton: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#22c55e',
    },
    newVideoButtonText: {
        color: '#22c55e',
        fontSize: 14,
        fontWeight: '600',
    },
    urlContainer: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#0f1f0f',
        borderRadius: 8,
    },
    urlLabel: {
        fontSize: 12,
        color: '#9ca3af',
        marginBottom: 4,
    },
    urlText: {
        fontSize: 12,
        color: '#86efac',
        fontFamily: 'monospace',
    },
    infoSection: {
        backgroundColor: '#1f1f2e',
        borderRadius: 12,
        padding: 20,
        marginTop: 10,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e5e7eb',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#9ca3af',
        marginBottom: 8,
        lineHeight: 20,
    },
});

export default VideoCreator;
