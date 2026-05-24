import { useState, useEffect, useRef } from 'react';

import { WellnessFormWizard } from './WellnessFormWizard';

import { WellnessRecommendationsResult } from './WellnessRecommendationsResult';

import { X } from 'lucide-react';

import type { WellnessRecommendationsResponse } from '../types/types';



interface FormModalProps {

    isOpen: boolean;

    onClose: () => void;

}



export function FormModal({ isOpen, onClose }: FormModalProps) {

    const [showResults, setShowResults] = useState(false);

    const [resultData, setResultData] = useState<WellnessRecommendationsResponse | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);



    const token = localStorage.getItem('token');

    const storedUser = localStorage.getItem('user');

    const user = storedUser ? JSON.parse(storedUser) : { id: 2 };



    useEffect(() => {

        if (isOpen) {

            document.body.style.overflow = 'hidden';

        } else {

            document.body.style.overflow = 'unset';

            setShowResults(false);

            setResultData(null);

        }

        return () => {

            document.body.style.overflow = 'unset';

        };

    }, [isOpen]);



    useEffect(() => {

        scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });

    }, [showResults]);



    if (!isOpen) return null;



    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">

            <button

                type="button"

                aria-label="Cerrar modal"

                className="absolute inset-0 cursor-default"

                style={{ background: 'rgba(80, 93, 79, 0.45)', backdropFilter: 'blur(8px)' }}

                onClick={onClose}

            />



            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col wellness-modal">

                <button

                    type="button"

                    onClick={onClose}

                    className="absolute top-5 right-5 z-10 rounded-full p-2 wellness-muted hover:opacity-70 transition-opacity"

                >

                    <X className="size-6" />

                </button>



                <div ref={scrollRef} className="p-6 md:p-10 overflow-y-auto">

                    {showResults && resultData ? (

                        <WellnessRecommendationsResult
                            data={resultData}
                            token={token}
                            onClose={() => {
                                setShowResults(false);
                                onClose();
                            }}
                            onRetake={() => {
                                setShowResults(false);
                                setResultData(null);
                            }}
                        />

                    ) : (

                        <WellnessFormWizard

                            userId={user.id}

                            token={token}

                            onClose={onClose}

                            onComplete={(result) => {

                                setResultData(result);

                                setShowResults(true);

                            }}

                        />

                    )}

                </div>

            </div>

        </div>

    );

}

