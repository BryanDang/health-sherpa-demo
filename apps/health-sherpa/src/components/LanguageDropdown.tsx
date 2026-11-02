// src/components/LanguageDropdown.tsx
// Language selection dropdown for header, placeholder with "coming soon" message
// Interacts with: MainLayout.tsx header section

'use client';

import { useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export function LanguageDropdown() {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const { toast } = useToast();

  const handleLanguageSelect = (language: string) => {
    if (language === 'English') {
      setSelectedLanguage(language);
    } else {
      // Show "coming soon" message for other languages
      toast({
        title: 'Coming Soon!',
        description: `${language} support is in development. Stay tuned!`,
      });
    }
  };

  const languages = [
    'English',
    'Spanish',
    'French',
    'German',
    'Portuguese',
    'Chinese',
    'Arabic',
    'Russian',
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{selectedLanguage}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language}
            onClick={() => handleLanguageSelect(language)}
            className={`cursor-pointer ${
              selectedLanguage === language ? 'bg-primary/10 font-medium' : ''
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span>{language}</span>
              {language !== 'English' && (
                <span className="text-xs text-muted-foreground ml-2">Soon</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
